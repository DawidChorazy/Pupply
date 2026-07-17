import { AccountRole, BookingStatus, NotificationType, Prisma } from "@prisma/client";

import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";

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

export async function createBooking(
  accountId: string,
  role: AccountRole,
  input: { petId: string; sitterServiceId: string; availabilitySlotId: string; note?: string }
) {
  requireUser(role);
  const [pet, service, slot] = await Promise.all([
    prisma.pet.findFirst({ where: { id: input.petId, accountId } }),
    prisma.sitterService.findFirst({
      where: { id: input.sitterServiceId, isActive: true, sitterProfile: { isActive: true } },
      include: { sitterProfile: true }
    }),
    prisma.availabilitySlot.findUnique({ where: { id: input.availabilitySlotId } })
  ]);
  if (!pet) throw new AppError(404, "Pet was not found", "PET_NOT_FOUND");
  if (!service) throw new AppError(404, "Sitter service was not found", "SERVICE_NOT_FOUND");
  if (!slot || slot.sitterProfileId !== service.sitterProfileId) {
    throw new AppError(404, "Availability slot was not found", "AVAILABILITY_NOT_FOUND");
  }
  if (service.sitterProfile.accountId === accountId) {
    throw new AppError(409, "You cannot book your own service", "SELF_BOOKING_NOT_ALLOWED");
  }
  if (slot.startsAt <= new Date()) throw new AppError(409, "Availability slot has already started", "SLOT_UNAVAILABLE");
  const slotMinutes = (slot.endsAt.getTime() - slot.startsAt.getTime()) / 60_000;
  if (slotMinutes < service.durationMinutes) {
    throw new AppError(409, "Availability slot is too short for this service", "SLOT_TOO_SHORT");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          ownerAccountId: accountId,
          sitterAccountId: service.sitterProfile.accountId,
          petId: pet.id,
          sitterServiceId: service.id,
          availabilitySlotId: slot.id,
          activeSlotKey: slot.id,
          priceCents: service.priceCents,
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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
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
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, OR: [{ ownerAccountId: accountId }, { sitterAccountId: accountId }] },
    include: bookingInclude
  });
  if (!booking) throw new AppError(404, "Booking was not found", "BOOKING_NOT_FOUND");
  return booking;
}

function assertStatusTransition(
  booking: { status: BookingStatus; ownerAccountId: string; sitterAccountId: string; availabilitySlot: { endsAt: Date } },
  accountId: string,
  target: BookingStatus
) {
  const isOwner = booking.ownerAccountId === accountId;
  const isSitter = booking.sitterAccountId === accountId;
  const allowed =
    (isSitter && booking.status === "REQUESTED" && ["ACCEPTED", "REJECTED"].includes(target)) ||
    ((isOwner || isSitter) && ["REQUESTED", "ACCEPTED"].includes(booking.status) && target === "CANCELLED") ||
    (isSitter && booking.status === "ACCEPTED" && target === "COMPLETED" && booking.availabilitySlot.endsAt <= new Date());
  if (!allowed) throw new AppError(409, "Booking status transition is not allowed", "INVALID_BOOKING_TRANSITION");
}

const notificationForStatus: Record<Exclude<BookingStatus, "REQUESTED">, { type: NotificationType; title: string }> = {
  ACCEPTED: { type: "BOOKING_ACCEPTED", title: "Rezerwacja zaakceptowana" },
  REJECTED: { type: "BOOKING_REJECTED", title: "Rezerwacja odrzucona" },
  CANCELLED: { type: "BOOKING_CANCELLED", title: "Rezerwacja anulowana" },
  COMPLETED: { type: "BOOKING_COMPLETED", title: "Rezerwacja zakończona" }
};

export async function updateBookingStatus(
  accountId: string,
  role: AccountRole,
  bookingId: string,
  target: Exclude<BookingStatus, "REQUESTED">
) {
  const booking = await getBooking(accountId, role, bookingId);
  assertStatusTransition(booking, accountId, target);
  const recipientId = booking.ownerAccountId === accountId ? booking.sitterAccountId : booking.ownerAccountId;
  const notification = notificationForStatus[target];

  return prisma.$transaction(async (tx) => {
    const changed = await tx.booking.updateMany({
      where: { id: booking.id, status: booking.status },
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
