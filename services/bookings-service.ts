import { API_ENDPOINTS } from "@/constants/api";
import {
  Booking,
  BookingStatus,
  CreateBookingPayload,
  CreateBookingsPayload,
  ListBookingsParams,
  PaginatedBookingsResponse
} from "@/types/marketplace";

import { ApiError, authenticatedApiRequest } from "./api-client";
import { bookingOperation, forgetBookingOperation, pendingBookingOperations } from "./booking-operations";
import { getSessionRevision } from "./session-events";

function queryString(params: ListBookingsParams) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return query ? `?${query}` : "";
}

export function createBooking(payload: CreateBookingPayload) {
  return sendBooking<{ booking: Booking }>(API_ENDPOINTS.bookings.create, payload);
}

export function createBookings(payload: CreateBookingsPayload) {
  return sendBooking<{ bookings: Booking[]; totalPriceCents: number }>(API_ENDPOINTS.bookings.batch, payload);
}

async function sendBooking<T>(path: string, payload: CreateBookingPayload | CreateBookingsPayload): Promise<T> {
  const revision = getSessionRevision(), body = JSON.stringify(payload);
  const operation = await bookingOperation(path, body);
  if (revision !== getSessionRevision()) throw new ApiError("Sesja została zmieniona", 401);
  try {
    const result = await authenticatedApiRequest<T>(path, { method: "POST", body, headers: { "Idempotency-Key": operation.key } });
    await forgetBookingOperation(operation);
    return result;
  } catch (error) {
    // A transport/server failure can occur after commit. Retain the key so a retry
    // or a page reload recovers that exact operation instead of creating another.
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) await forgetBookingOperation(operation);
    throw error;
  }
}

export async function recoverPendingBookings(): Promise<boolean> {
  let recovered = false;
  for (const operation of await pendingBookingOperations()) {
    try {
      await authenticatedApiRequest(API_ENDPOINTS.bookings.operation(operation.key));
      await forgetBookingOperation(operation); recovered = true;
    } catch (error) { if (!(error instanceof ApiError && error.status === 404)) throw error; }
  }
  return recovered;
}

export function listBookings(params: ListBookingsParams = {}) {
  return authenticatedApiRequest<PaginatedBookingsResponse>(
    `${API_ENDPOINTS.bookings.list}${queryString(params)}`
  );
}

export function getBooking(bookingId: string) {
  return authenticatedApiRequest<{ booking: Booking }>(API_ENDPOINTS.bookings.detail(bookingId));
}

export function updateBookingStatus(bookingId: string, status: Exclude<BookingStatus, "REQUESTED" | "EXPIRED">) {
  return authenticatedApiRequest<{ booking: Booking }>(API_ENDPOINTS.bookings.status(bookingId), {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}
