import { apiRequest } from "./api-client";

export interface CareLocation {
  id: string;
  city: string;
  region: string;
  county: string;
  latitude: number;
  longitude: number;
}

export function searchLocations(query: string, signal?: AbortSignal) {
  return apiRequest<{ items: CareLocation[] }>(`/locations/search?q=${encodeURIComponent(query)}`, { signal });
}

export function reverseLocation(latitude: number, longitude: number) {
  return apiRequest<{ items: CareLocation[] }>(`/locations/reverse?latitude=${latitude}&longitude=${longitude}`);
}
