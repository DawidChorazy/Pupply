import { AccountRole, BookingStatus, NotificationType, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";

import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { env } from "../config/env";
import { requireVerifiedEmail } from "./account-access.service";
import { expireBookingRequests, expireConflictingBookingRequests } from "./booking-expiry.service";
import { retryTransaction } from "../utils/transaction-retry";

function requireUser(role: AccountRole) {
  if (role !== "USER") throw new AppError(403, "Only users can manage bookings", "FORBIDDEN");
}

const bookingInclude = {
  pet: { select: { id: true, name: true, breed: true } },
  owner: { select: { id: true, userProfile: { select: { fullName: true } } } },
  sitter: { select: { id: true, userProfile: { select: { fullName: true } } } },
  sitterService: true,
  availabilitySlot: true
};

type BookingInput = {
  petId: string;
  sitterServiceId: string;
  availabilitySlotId: string;
  startsAt?: Date;
  durationMinutes?: number;
  expectedPriceCents?: number;
  note?: string;
};

type JsonResult<T> = T extends Date ? string : T extends (infer U)[] ? JsonResult<U>[]
  : T extends object ? { [K in keyof T]: JsonResult<T[K]> } : T;
type BookingResult = JsonResult<Prisma.BookingGetPayload<{ include: typeof bookingInclude }>>;

function requestHash(kind: string, inputs: BookingInput[]) {
  const entries = inputs.map(input => ({
    petId: input.petId, sitterServiceId: input.sitterServiceId, availabilitySlotId: input.availabilitySlotId,
    startsAt: input.startsAt?.toISOString() ?? null, durationMinutes: input.durationMinutes ?? null,
    expectedPriceCents: input.expectedPriceCents ?? null, note: input.note ?? null
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return createHash("sha256").update(JSON.stringify({ kind, entries })).digest("hex");
}

async function createBookingInTransaction(tx: Prisma.TransactionClient, accountId: string, input: BookingInput) {
  const [pet, service, slot] = await Promise.all([
    tx.pet.findFirst({ where: { id: input.petId, accountId } }),
    tx.sitterService.findFirst({
      where: { id: input.sitterServiceId, isActive: true, sitterProfile: { isActive: true } },
      include: { sitterProfile: true }
    }),
    (async () => {
      await tx.$queryRaw`SELECT id FROM "AvailabilitySlot" WHERE id = ${input.availabilitySlotId} FOR SHARE`;
      return tx.availabilitySlot.findUnique({ where: { id: input.availabilitySlotId } });
    })()
  ]);
  if (!pet) throw new AppError(404, "Pet was not found", "PET_NOT_FOUND");
  if (!service) throw new AppError(404, "Sitter service was not found", "SERVICE_NOT_FOUND");
  if (!slot || slot.archivedAt || slot.sitterProfileId !== service.sitterProfileId) {
    throw new AppError(404, "Availability slot was not found", "AVAILABILITY_NOT_FOUND");
  }
  if (service.sitterProfile.accountId === accountId) {
    throw new AppError(409, "You cannot book your own service", "SELF_BOOKING_NOT_ALLOWED");
  }
  const participants = await tx.$queryRaw<{ id: string; emailVerifiedAt: Date | null; blockedAt: Date | null; deactivatedAt: Date | null }[]>`
    SELECT id, "emailVerifiedAt", "blockedAt", "deactivatedAt" FROM "Account"
    WHERE id IN (${accountId}, ${service.sitterProfile.accountId}) ORDER BY id FOR SHARE`;
  if (participants.length !== 2 || participants.some(account => account.blockedAt || account.deactivatedAt || !account.emailVerifiedAt))
    throw new AppError(409, "One of the booking participants is unavailable", "ACCOUNT_UNAVAILABLE");
  const durationMinutes = input.durationMinutes ?? service.durationMinutes;
  if (!Number.isInteger(durationMinutes) || durationMinutes < service.durationMinutes || durationMinutes > 1440) {
    throw new AppError(400, "Czas opieki musi być co najmniej tak długi jak wybrana usługa i nie może przekroczyć 24 godzin.", "INVALID_BOOKING_DURATION");
  }
  const priceCents = Math.round(service.priceCents * durationMinutes / service.durationMinutes);
  if (input.expectedPriceCents !== undefined && input.expectedPriceCents !== priceCents) {
    throw new AppError(409, "Cena oferty zmieniła się. Odśwież kalendarz i sprawdź aktualną kwotę przed rezerwacją.", "PRICE_CHANGED");
  }
  const slotMinutes = (slot.endsAt.getTime() - slot.startsAt.getTime()) / 60_000;
  if (slotMinutes < durationMinutes) {
    throw new AppError(409, "Availability slot is too short for this service", "SLOT_TOO_SHORT");
  }
  const startsAt = input.startsAt ?? slot.startsAt;
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  if (startsAt < slot.startsAt || startsAt <= new Date() || endsAt > slot.endsAt) {
    throw new AppError(409, "Selected time does not fit the available slot", "SLOT_UNAVAILABLE");
  }
  const expiresAt = new Date(Math.min(startsAt.getTime(), Date.now() + env.BOOKING_REQUEST_TTL_HOURS * 3_600_000));
  // Expire only requests which could block this concrete appointment, including
  // old archived slots or another sitter's request for the same pet. This runs
  // atomically with the new reservation and never scans unrelated schedules.
  await expireConflictingBookingRequests(tx, new Date(), { sitterAccountId: service.sitterProfile.accountId, petId: pet.id, startsAt, endsAt });

  const booking = await tx.booking.create({
    data: {
      ownerAccountId: accountId,
      sitterAccountId: service.sitterProfile.accountId,
      petId: pet.id,
      sitterServiceId: service.id,
      availabilitySlotId: slot.id,
      activeSlotKey: slot.id,
      startsAt,
      endsAt,
      expiresAt,
      priceCents,
      currency: "PLN",
      note: input.note
    },
    include: bookingInclude
  });
  await tx.notification.create({
    data: {
      accountId: booking.sitterAccountId,
      bookingId: booking.id,
      type: "BOOKING_REQUESTED",
      title: "Nowa prośba o rezerwację",
      message: `Nowa rezerwacja dla ${booking.pet.name}.`
    }
  });
  return booking;
}

export async function createBooking(accountId: string, role: AccountRole, input: BookingInput, operationKey?: string) {
  return (await createBookings(accountId, role, [input], operationKey, "single"))[0];
}

export async function getBookingOperation(accountId: string, role: AccountRole, key: string) {
  requireUser(role);
  const operation = await prisma.bookingOperation.findUnique({ where: { accountId_key: { accountId, key } } });
  if (!operation?.result) throw new AppError(404, "Nie znaleziono zakończonej operacji.", "BOOKING_OPERATION_NOT_FOUND");
  const bookings = operation.result as unknown as BookingResult[];
  return { bookings, totalPriceCents: bookings.reduce((sum, booking) => sum + booking.priceCents, 0) };
}

export async function createBookings(accountId: string, role: AccountRole, inputs: BookingInput[], operationKey?: string, kind = "batch"): Promise<BookingResult[]> {
  requireUser(role);
  await requireVerifiedEmail(accountId);
  const hash = requestHash(kind, inputs);
  try {
    return await retryTransaction(() => prisma.$transaction(async tx => {
      if (operationKey) {
        // The unique row and result are committed with the bookings. Concurrent
        // retries either wait or retry their Serializable snapshot, then replay.
        await tx.$executeRaw`INSERT INTO "BookingOperation" ("accountId", key, "requestHash")
          VALUES (${accountId}, ${operationKey}, ${hash}) ON CONFLICT DO NOTHING`;
        const operation = await tx.bookingOperation.findUniqueOrThrow({ where: { accountId_key: { accountId, key: operationKey } } });
        if (operation.requestHash !== hash) throw new AppError(409, "Identyfikator operacji został już użyty z innymi danymi.", "IDEMPOTENCY_KEY_REUSED");
        if (operation.result !== null) return operation.result as unknown as BookingResult[];
      }
      const bookings = [];
      // Acquire slot locks consistently across batches. Any failed day rolls back
      // all bookings and notifications, including ones created earlier here.
      const ordered = [...inputs].sort((a, b) => a.availabilitySlotId.localeCompare(b.availabilitySlotId)
        || (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0));
      for (const input of ordered) bookings.push(await createBookingInTransaction(tx, accountId, input));
      const result = JSON.parse(JSON.stringify(bookings.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()))) as BookingResult[];
      if (operationKey) await tx.bookingOperation.update({ where: { accountId_key: { accountId, key: operationKey } }, data: { result: result as Prisma.InputJsonValue } });
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (
      ["P2002", "P2004"].includes(error.code)
    )) {
      throw new AppError(409, "Availability slot is already booked", "SLOT_ALREADY_BOOKED");
    }
    throw error;
  }
}

export async function listBookings(
  accountId: string,
  role: AccountRole,
  input: { perspective: "owner" | "sitter" | "all"; status?: BookingStatus; page: number; pageSize: number }
) {
  requireUser(role);
  await expireBookingRequests(new Date(), { accountId });
  const participantFilter: Prisma.BookingWhereInput =
    input.perspective === "owner"
      ? { ownerAccountId: accountId }
      : input.perspective === "sitter"
        ? { sitterAccountId: accountId }
        : { OR: [{ ownerAccountId: accountId }, { sitterAccountId: accountId }] };
  const where: Prisma.BookingWhereInput = { ...participantFilter, status: input.status };
  const [items, total] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize
    }),
    prisma.booking.count({ where })
  ]);
  return { items, pagination: { page: input.page, pageSize: input.pageSize, total } };
}

export async function getBooking(accountId: string, role: AccountRole, bookingId: string) {
  requireUser(role);
  await expireBookingRequests(new Date(), { accountId });
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, OR: [{ ownerAccountId: accountId }, { sitterAccountId: accountId }] },
    include: bookingInclude
  });
  if (!booking) throw new AppError(404, "Booking was not found", "BOOKING_NOT_FOUND");
  return booking;
}

function assertStatusTransition(
  booking: { status: BookingStatus; ownerAccountId: string; sitterAccountId: string; startsAt: Date; endsAt: Date; expiresAt: Date },
  accountId: string,
  target: BookingStatus
) {
  const isOwner = booking.ownerAccountId === accountId;
  const isSitter = booking.sitterAccountId === accountId;
  const allowed =
    (isSitter && booking.status === "REQUESTED" && booking.startsAt > new Date() && booking.expiresAt > new Date() && ["ACCEPTED", "REJECTED"].includes(target)) ||
    ((isOwner || isSitter) && ["REQUESTED", "ACCEPTED"].includes(booking.status) && target === "CANCELLED") ||
    (isSitter && booking.status === "ACCEPTED" && target === "COMPLETED" && booking.endsAt <= new Date());
  if (!allowed) throw new AppError(409, "Booking status transition is not allowed", "INVALID_BOOKING_TRANSITION");
}

const notificationForStatus: Record<Exclude<BookingStatus, "REQUESTED" | "EXPIRED">, { type: NotificationType; title: string }> = {
  ACCEPTED: { type: "BOOKING_ACCEPTED", title: "Rezerwacja zaakceptowana" },
  REJECTED: { type: "BOOKING_REJECTED", title: "Rezerwacja odrzucona" },
  CANCELLED: { type: "BOOKING_CANCELLED", title: "Rezerwacja anulowana" },
  COMPLETED: { type: "BOOKING_COMPLETED", title: "Rezerwacja zakończona" }
};

export async function updateBookingStatus(
  accountId: string,
  role: AccountRole,
  bookingId: string,
  target: Exclude<BookingStatus, "REQUESTED" | "EXPIRED">
) {
  if (target === "ACCEPTED") await requireVerifiedEmail(accountId);
  const booking = await getBooking(accountId, role, bookingId);
  assertStatusTransition(booking, accountId, target);
  const recipientId = booking.ownerAccountId === accountId ? booking.sitterAccountId : booking.ownerAccountId;
  const notification = notificationForStatus[target];

  return prisma.$transaction(async (tx) => {
    const changed = await tx.booking.updateMany({
      where: { id: booking.id, status: booking.status, ...(target === "ACCEPTED" ? { startsAt: { gt: new Date() }, expiresAt: { gt: new Date() } } : {}) },
      data: {
        status: target,
        activeSlotKey: ["REJECTED", "CANCELLED", "COMPLETED"].includes(target) ? null : booking.availabilitySlotId
      }
    });
    if (changed.count !== 1) throw new AppError(409, "Booking was changed by another request", "BOOKING_CONFLICT");
    await tx.notification.create({
      data: {
        accountId: recipientId,
        bookingId: booking.id,
        type: notification.type,
        title: notification.title,
        message: `${notification.title}: ${booking.pet.name}.`
      }
    });
    return tx.booking.findUniqueOrThrow({ where: { id: booking.id }, include: bookingInclude });
  });
}
