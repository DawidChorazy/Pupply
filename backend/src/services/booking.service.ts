import { AccountRole, BookingStatus, NotificationType, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";

import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { env } from "../config/env";
import { requireVerifiedEmail, requireVerifiedSitter } from "./account-access.service";
import { expireBookingRequests, expireConflictingBookingRequests } from "./booking-expiry.service";
import { retryTransaction } from "../utils/transaction-retry";
import { assertBookingPaid, cancellationFee, schedulePaymentCancellation, settleBooking } from "./payment-state.service";
import { missingPetFields, vaccinationDateCutoff } from "./pets.service";
import { z } from "zod";

function requireUser(role: AccountRole) {
  if (role !== "USER") throw new AppError(403, "Only users can manage bookings", "FORBIDDEN");
}

const bookingInclude = {
  review: true,
  walkSession: true,
  payments: { select: { id: true, status: true, amountCents: true, currency: true, environment: true, createdAt: true, completedAt: true,
    refund: { select: { id: true, amountCents: true, status: true } } }, orderBy: { createdAt: "desc" as const }, take: 5 },
  settlement: true,
  issue: { select: { id: true, status: true } },
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
  pickupAddress: string;
  note?: string;
};

type JsonResult<T> = T extends Date ? string : T extends (infer U)[] ? JsonResult<U>[]
  : T extends object ? { [K in keyof T]: JsonResult<T[K]> } : T;
type BookingResult = JsonResult<Prisma.BookingGetPayload<{ include: typeof bookingInclude }>>;

function requestHash(kind: string, inputs: BookingInput[]) {
  const entries = inputs.map(input => ({
    petId: input.petId, sitterServiceId: input.sitterServiceId, availabilitySlotId: input.availabilitySlotId,
    startsAt: input.startsAt?.toISOString() ?? null, durationMinutes: input.durationMinutes ?? null,
    expectedPriceCents: input.expectedPriceCents ?? null, pickupAddress: input.pickupAddress, note: input.note ?? null
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return createHash("sha256").update(JSON.stringify({ kind, entries })).digest("hex");
}

async function createBookingInTransaction(tx: Prisma.TransactionClient, accountId: string, input: BookingInput) {
  const pickupAddress = z.string().trim().min(5).max(500).parse(input.pickupAddress);
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
  await requireVerifiedSitter(service.sitterProfile.accountId, tx);
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
  const proof = await tx.petDocument.findFirst({ where: { petId: pet.id, purpose: "VACCINATION", uploadedAt: { not: null },
    OR: [{ expiresAt: null }, { expiresAt: { gte: vaccinationDateCutoff(endsAt) } }] } });
  const missing = missingPetFields(pet, !!proof);
  if (missing.length) throw new AppError(409, `Uzupełnij profil pupila przed rezerwacją: ${missing.join(", ")}.`, "PET_PROFILE_INCOMPLETE");
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
      paymentRequired: priceCents > 0,
      currency: "PLN",
      pickupAddress,
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
    include: {
      ...bookingInclude,
      pet: { select: { ...bookingInclude.pet.select, temperament: true, mobilityRestrictions: true, careInstructions: true } }
    }
  });
  if (!booking) throw new AppError(404, "Booking was not found", "BOOKING_NOT_FOUND");
  if (booking.status === "ACCEPTED") return booking;
  const { id, name, breed } = booking.pet;
  return { ...booking, pet: { id, name, breed } };
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
  target: Exclude<BookingStatus, "REQUESTED" | "EXPIRED">,
  expectedCancellationFeeCents?: number
) {
  if (target === "ACCEPTED") await requireVerifiedEmail(accountId);
  const booking = await getBooking(accountId, role, bookingId);
  const recipientId = booking.ownerAccountId === accountId ? booking.sitterAccountId : booking.ownerAccountId;
  const notification = notificationForStatus[target];

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${booking.id} FOR UPDATE`;
    const current = await tx.booking.findUniqueOrThrow({ where: { id: booking.id } });
    assertStatusTransition(current, accountId, target);
    if (target === "ACCEPTED") await requireVerifiedSitter(accountId, tx);
    if (target === "COMPLETED") await assertBookingPaid(tx, current);
    const fee = target === "CANCELLED" ? cancellationFee(current, accountId) : 0;
    if (fee > 0 && expectedCancellationFeeCents !== fee)
      throw new AppError(409, "Anulowanie wymaga potwierdzenia aktualnej opłaty. Sprawdź podsumowanie anulowania.", "CANCELLATION_FEE_CONFIRMATION_REQUIRED");
    const walk = await tx.walkSession.findUnique({ where: { bookingId: booking.id } });
    if (target === "COMPLETED" && walk && !walk.endedAt)
      throw new AppError(409, "Zakończ aktywny spacer na ekranie GPS, aby zapisać całą trasę.", "WALK_ACTIVE");
    const changed = await tx.booking.updateMany({
      where: { id: booking.id, status: current.status, ...(target === "ACCEPTED" ? { startsAt: { gt: new Date() }, expiresAt: { gt: new Date() } } : {}) },
      data: {
        status: target,
        ...(target === "ACCEPTED" && current.paymentRequired ? { paymentDueAt: new Date(Math.min(current.startsAt.getTime(), Date.now() + env.PAYMENT_TIMEOUT_MINUTES * 60_000)) } : {}),
        ...(target === "CANCELLED" ? { cancellationFeeCents: fee, cancelledAt: new Date() } : {}),
        activeSlotKey: ["REJECTED", "CANCELLED", "COMPLETED"].includes(target) ? null : booking.availabilitySlotId
      }
    });
    if (changed.count !== 1) throw new AppError(409, "Booking was changed by another request", "BOOKING_CONFLICT");
    if (target === "CANCELLED") await tx.walkSession.updateMany({ where: { bookingId: booking.id, endedAt: null }, data: { endedAt: new Date(), endReason: "CANCELLED" } });
    const updated = await tx.booking.findUniqueOrThrow({ where: { id: booking.id } });
    if (["CANCELLED", "REJECTED"].includes(target)) await schedulePaymentCancellation(tx, updated);
    if (target === "COMPLETED") await settleBooking(tx, updated);
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
