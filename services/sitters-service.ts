import { API_ENDPOINTS } from "@/constants/api";
import {
  AvailabilitySlot,
  CreateSitterProfilePayload,
  PaginatedSittersResponse,
  SearchSittersParams,
  SitterProfile,
  SitterService,
  UpdateSitterProfilePayload
} from "@/types/marketplace";

import { apiRequest, authenticatedApiRequest } from "./api-client";

function queryString(params: Record<string, string | number | boolean | undefined>) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return query ? `?${query}` : "";
}

export function searchSitters(params: SearchSittersParams) {
  return apiRequest<PaginatedSittersResponse>(
    `${API_ENDPOINTS.sitters.list}${queryString({ ...params })}`
  );
}

export function getMySitterProfile() {
  return authenticatedApiRequest<{ profile: SitterProfile }>(API_ENDPOINTS.sitters.me);
}

export function createSitterProfile(payload: CreateSitterProfilePayload) {
  return authenticatedApiRequest<{ profile: SitterProfile }>(API_ENDPOINTS.sitters.me, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateSitterProfile(payload: UpdateSitterProfilePayload) {
  return authenticatedApiRequest<{ profile: SitterProfile }>(API_ENDPOINTS.sitters.me, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function addAvailability(startsAt: string, endsAt: string) {
  return authenticatedApiRequest<{ slot: AvailabilitySlot }>(API_ENDPOINTS.sitters.availability, {
    method: "POST",
    body: JSON.stringify({ startsAt, endsAt })
  });
}

export function deleteAvailability(slotId: string) {
  return authenticatedApiRequest<void>(API_ENDPOINTS.sitters.availabilityDetail(slotId), {
    method: "DELETE"
  });
}

export function addAvailabilityBatch(slots: { startsAt: string; endsAt: string }[]) {
  return authenticatedApiRequest<{ slots: AvailabilitySlot[] }>(API_ENDPOINTS.sitters.availabilityBatch, {
    method: "POST", body: JSON.stringify({ slots })
  });
}

export function updateAvailability(slotId: string, startsAt: string, endsAt: string) {
  return authenticatedApiRequest<{ slot: AvailabilitySlot }>(API_ENDPOINTS.sitters.availabilityDetail(slotId), {
    method: "PATCH", body: JSON.stringify({ startsAt, endsAt })
  });
}

export async function getSitterAvailability(profileId: string, sitterServiceId: string, window: { from: string; to: string }) {
  const availability: AvailabilitySlot[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const response: { service: SitterService; availability: AvailabilitySlot[]; nextCursor?: string | null } = await apiRequest(
      `${API_ENDPOINTS.sitters.publicAvailability(profileId)}${queryString({ sitterServiceId, ...window, limit: 200, cursor })}`
    );
    availability.push(...response.availability);
    if (!response.nextCursor) return { service: response.service, availability };
    cursor = response.nextCursor;
  }
  throw new Error("W tym miesiącu jest zbyt wiele przedziałów dostępności. Skontaktuj się z opiekunem.");
}

export async function getMySchedule(window: { from: string; to: string }) {
  const slots: AvailabilitySlot[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const response: { slots: AvailabilitySlot[]; nextCursor?: string | null } = await authenticatedApiRequest(
      `${API_ENDPOINTS.sitters.schedule}${queryString({ ...window, limit: 200, cursor })}`
    );
    slots.push(...response.slots);
    if (!response.nextCursor) return { slots };
    cursor = response.nextCursor;
  }
  throw new Error("W tym miesiącu jest zbyt wiele przedziałów. Uporządkuj grafik przed dalszą edycją.");
}
