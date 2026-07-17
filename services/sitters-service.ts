import { API_ENDPOINTS } from "@/constants/api";
import {
  AvailabilitySlot,
  CreateSitterProfilePayload,
  PaginatedSittersResponse,
  SearchSittersParams,
  SitterProfile,
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
