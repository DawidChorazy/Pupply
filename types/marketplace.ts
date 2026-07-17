export type SitterServiceType = "DOG_WALK" | "DROP_IN" | "DAY_CARE";
export type BookingStatus = "REQUESTED" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "COMPLETED";
export type BookingPerspective = "owner" | "sitter" | "all";

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface SitterService {
  id: string;
  sitterProfileId: string;
  type: SitterServiceType;
  durationMinutes: number;
  priceCents: number;
  currency: "PLN";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilitySlot {
  id: string;
  sitterProfileId: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
}

export interface SitterProfile {
  id: string;
  accountId: string;
  bio: string;
  city: string;
  latitude: number;
  longitude: number;
  serviceRadiusKm: number;
  isActive: boolean;
  services: SitterService[];
  availability: AvailabilitySlot[];
  createdAt: string;
  updatedAt: string;
}

export interface SitterSearchItem {
  id: string;
  displayName: string;
  bio: string;
  city: string;
  serviceRadiusKm: number;
  distanceKm: number;
  services: SitterService[];
  availability: AvailabilitySlot[];
}

export interface SitterServiceInput {
  type: SitterServiceType;
  durationMinutes: number;
  priceCents: number;
  isActive?: boolean;
}

export interface CreateSitterProfilePayload {
  bio: string;
  city: string;
  latitude: number;
  longitude: number;
  serviceRadiusKm: number;
  isActive: boolean;
  services: SitterServiceInput[];
}

export type UpdateSitterProfilePayload = Partial<CreateSitterProfilePayload>;

export interface SearchSittersParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  serviceType?: SitterServiceType;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface Booking {
  id: string;
  ownerAccountId: string;
  sitterAccountId: string;
  petId: string;
  sitterServiceId: string;
  availabilitySlotId: string;
  status: BookingStatus;
  priceCents: number;
  currency: "PLN";
  note: string | null;
  createdAt: string;
  updatedAt: string;
  pet: { id: string; name: string; breed: string | null };
  owner: { id: string; userProfile: { fullName: string } | null };
  sitter: { id: string; userProfile: { fullName: string } | null };
  sitterService: SitterService;
  availabilitySlot: AvailabilitySlot;
}

export interface CreateBookingPayload {
  petId: string;
  sitterServiceId: string;
  availabilitySlotId: string;
  note?: string;
}

export interface ListBookingsParams {
  perspective?: BookingPerspective;
  status?: BookingStatus;
  page?: number;
  pageSize?: number;
}

export interface PaginatedSittersResponse {
  items: SitterSearchItem[];
  pagination: Pagination;
}

export interface PaginatedBookingsResponse {
  items: Booking[];
  pagination: Pagination;
}
