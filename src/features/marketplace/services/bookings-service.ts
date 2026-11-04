import { API_ENDPOINTS } from "@/shared/api/config";
import {
  Booking,
  BookingStatus,
  CreateBookingPayload,
  ListBookingsParams,
  PaginatedBookingsResponse
} from "@/features/marketplace/types/marketplace";

import { authenticatedApiRequest } from "@/shared/api/api-client";

function queryString(params: ListBookingsParams) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return query ? `?${query}` : "";
}

export function createBooking(payload: CreateBookingPayload) {
  return authenticatedApiRequest<{ booking: Booking }>(API_ENDPOINTS.bookings.create, {
    method: "POST",
    body: JSON.stringify(payload)
  });
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
