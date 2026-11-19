import { AccountRole, Prisma, WalkPoint } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { WalkPointInput } from "../validation/walk.schemas";
import { requireVerifiedEmail, requireVerifiedSitter } from "./account-access.service";
import { assertBookingPaid, settleBooking } from "./payment-state.service";

async function participant(client: Prisma.TransactionClient, accountId: string, role: AccountRole, bookingId: string, lock = false) {
  if (role !== "USER") throw new AppError(403, "Wymagane konto użytkownika.", "FORBIDDEN");
  if (lock) await client.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
  const booking = await client.booking.findFirst({ where: { id: bookingId, OR: [{ ownerAccountId: accountId }, { sitterAccountId: accountId }] }, include: { sitterService: true } });
  if (!booking) throw new AppError(404, "Nie znaleziono spaceru.", "BOOKING_NOT_FOUND");
  if (booking.sitterService.type !== "DOG_WALK") throw new AppError(409, "GPS jest dostępny dla spacerów.", "NOT_A_WALK");
  return booking;
}

export async function getWalk(accountId: string, role: AccountRole, bookingId: string, after = 0) {
  // One snapshot keeps counters, terminal status and the route page consistent.
  return prisma.$transaction(async tx => {
    const booking = await participant(tx, accountId, role, bookingId);
    const session = await tx.walkSession.findUnique({ where: { bookingId } });
    const paymentConfirmed = !booking.paymentRequired || !!booking.paidPaymentId;
    if (!session) return { session: null, points: [], nextAfter: null, bookingStatus: booking.status, paymentConfirmed };
    const points = await tx.walkPoint.findMany({ where: { sessionId: session.id, sequence: { gt: after } }, orderBy: { sequence: "asc" }, take: 500 });
    return { session, points, nextAfter: points.length && points.at(-1)!.sequence < session.lastSequence ? points.at(-1)!.sequence : null, bookingStatus: booking.status, paymentConfirmed };
  }, { isolationLevel: "RepeatableRead" });
}

export async function startWalk(accountId: string, role: AccountRole, bookingId: string) {
  await requireVerifiedEmail(accountId);
  try {
    return await prisma.$transaction(async tx => {
      const booking = await participant(tx, accountId, role, bookingId, true);
      if (booking.sitterAccountId !== accountId) throw new AppError(403, "Tylko opiekun może rozpocząć spacer.", "FORBIDDEN");
      const existing = await tx.walkSession.findUnique({ where: { bookingId } });
      if (existing && !existing.endedAt && booking.status === "ACCEPTED") return existing;
      if (existing || booking.status !== "ACCEPTED") throw new AppError(409, "Spacer musi być zaakceptowany i nie może być zakończony.", "WALK_NOT_AVAILABLE");
      await requireVerifiedSitter(accountId, tx);
      await assertBookingPaid(tx, booking);
      const now = new Date();
      if (now.getTime() < booking.startsAt.getTime() - 15 * 60_000 || now.getTime() > booking.endsAt.getTime() + 2 * 3_600_000)
        throw new AppError(409, "Spacer można rozpocząć od 15 minut przed terminem do 2 godzin po planowanym końcu.", "WALK_OUTSIDE_WINDOW");
      const session = await tx.walkSession.create({ data: { bookingId, sitterAccountId: accountId, startedAt: now } });
      await tx.notification.create({ data: { accountId: booking.ownerAccountId, bookingId, type: "WALK_STARTED", title: "Spacer rozpoczęty", message: "Opiekun rozpoczął spacer. Możesz sprawdzić trasę i ostatnią pozycję GPS." } });
      return session;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      throw new AppError(409, "Zakończ poprzedni spacer przed rozpoczęciem kolejnego.", "ANOTHER_WALK_ACTIVE");
    throw error;
  }
}

function meters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = Math.PI / 180, lat = (b.latitude - a.latitude) * rad, lon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(lon / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export async function appendWalkPoints(accountId: string, role: AccountRole, bookingId: string, points: WalkPointInput[]) {
  return prisma.$transaction(async tx => {
    const booking = await participant(tx, accountId, role, bookingId, true);
    if (booking.sitterAccountId !== accountId) throw new AppError(403, "Tylko opiekun może przesyłać pozycję.", "FORBIDDEN");
    const session = await tx.walkSession.findUnique({ where: { bookingId } });
    if (!session) throw new AppError(409, "Najpierw rozpocznij spacer.", "WALK_NOT_STARTED");
    const known = await tx.walkPoint.findMany({ where: { sessionId: session.id, clientPointId: { in: points.map(p => p.clientPointId) } } });
    const byId = new Map<string, WalkPointInput>(known.map(p => [p.clientPointId, p]));
    const fresh: WalkPointInput[] = [];
    for (const point of points) {
      const previous = byId.get(point.clientPointId);
      if (previous) {
        if (["latitude", "longitude", "accuracy"].some(key => previous[key as "latitude"] !== point[key as "latitude"]) || previous.capturedAt.getTime() !== point.capturedAt.getTime())
          throw new AppError(409, "Identyfikator pozycji został użyty z innymi danymi.", "POINT_ID_REUSED");
      } else { fresh.push(point); byId.set(point.clientPointId, point); }
    }
    // A lost-response retry remains safe even after finishing the walk.
    if (!fresh.length) return { acceptedIds: points.map(p => p.clientPointId), session };
    if (session.endedAt || booking.status !== "ACCEPTED") throw new AppError(409, "Spacer nie jest już aktywny.", "WALK_ENDED");
    if (session.lastSequence + fresh.length > 20000) throw new AppError(409, "Osiągnięto limit punktów trasy. Zakończ spacer.", "WALK_POINT_LIMIT");
    let previous: Pick<WalkPoint, "capturedAt" | "latitude" | "longitude" | "accuracy"> | null = await tx.walkPoint.findFirst({ where: { sessionId: session.id }, orderBy: { sequence: "desc" } });
    let anchor: Pick<WalkPoint, "latitude" | "longitude" | "accuracy"> | null = session.distanceAnchorSequence
      ? await tx.walkPoint.findUnique({ where: { sessionId_sequence: { sessionId: session.id, sequence: session.distanceAnchorSequence } } }) : previous;
    let anchorSequence = session.distanceAnchorSequence;
    const rows: Prisma.WalkPointCreateManyInput[] = [];
    let distance = 0;
    for (const point of fresh.sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime())) {
      if (point.capturedAt.getTime() < session.startedAt.getTime() - 10_000 || point.capturedAt.getTime() > Date.now() + 30_000 || (previous && point.capturedAt <= previous.capturedAt))
        throw new AppError(400, "Nieprawidłowa kolejność lub czas pozycji GPS.", "INVALID_POINT_TIME");
      const gapSeconds = previous ? (point.capturedAt.getTime() - previous.capturedAt.getTime()) / 1000 : 0;
      const step = previous ? meters(previous, point) : 0;
      // Do not bridge GPS outages or improbable jumps with an invented route.
      const segmentStart = !previous || gapSeconds > 120 || step / gapSeconds > 12;
      const sequence = session.lastSequence + rows.length + 1;
      // Accumulate small real steps from a stable anchor instead of discarding
      // every short sample independently (which would erase slow walks).
      if (segmentStart || !anchor) { anchor = point; anchorSequence = sequence; }
      else {
        const moved = meters(anchor, point);
        if (moved >= Math.max(3, Math.min(anchor.accuracy, point.accuracy) / 2)) {
          distance += moved; anchor = point; anchorSequence = sequence;
        }
      }
      rows.push({ ...point, sessionId: session.id, sequence, segmentStart });
      previous = point;
    }
    await tx.walkPoint.createMany({ data: rows });
    const updated = await tx.walkSession.update({ where: { id: session.id }, data: { lastSequence: { increment: rows.length }, distanceAnchorSequence: anchorSequence, distanceMeters: { increment: distance } } });
    return { acceptedIds: points.map(p => p.clientPointId), session: updated };
  });
}

export async function finishWalk(accountId: string, role: AccountRole, bookingId: string, reportedEnd?: Date) {
  return prisma.$transaction(async tx => {
    const booking = await participant(tx, accountId, role, bookingId, true);
    if (booking.sitterAccountId !== accountId) throw new AppError(403, "Tylko opiekun może zakończyć spacer.", "FORBIDDEN");
    const session = await tx.walkSession.findUnique({ where: { bookingId } });
    if (!session) throw new AppError(409, "Najpierw rozpocznij spacer.", "WALK_NOT_STARTED");
    if (session.endedAt) return session;
    if (booking.status !== "ACCEPTED") throw new AppError(409, "Spacer nie jest już aktywny.", "WALK_ENDED");
    const lastPoint = await tx.walkPoint.findFirst({ where: { sessionId: session.id }, orderBy: { sequence: "desc" }, select: { capturedAt: true } });
    const endedAt = reportedEnd ?? new Date(Math.max(Date.now(), lastPoint?.capturedAt.getTime() ?? 0));
    if (endedAt < session.startedAt || endedAt.getTime() > Date.now() + 30_000 || (lastPoint && endedAt < lastPoint.capturedAt))
      throw new AppError(400, "Koniec spaceru nie może poprzedzać rozpoczęcia ani ostatniego punktu GPS i nie może być w przyszłości.", "INVALID_WALK_END_TIME");
    const updated = await tx.walkSession.update({ where: { id: session.id }, data: { endedAt, endReason: "COMPLETED" } });
    const completed = await tx.booking.update({ where: { id: bookingId }, data: { status: "COMPLETED", activeSlotKey: null } });
    await settleBooking(tx, completed);
    await tx.notification.create({ data: { accountId: booking.ownerAccountId, bookingId, type: "BOOKING_COMPLETED", title: "Spacer zakończony", message: "Opiekun zakończył spacer. Podsumowanie zawiera zapisaną trasę, czas i dystans." } });
    return updated;
  });
}
