import { Pagination } from "./marketplace";

export type NotificationType =
  | "BOOKING_REQUESTED"
  | "BOOKING_ACCEPTED"
  | "BOOKING_REJECTED"
  | "BOOKING_CANCELLED"
  | "BOOKING_COMPLETED";

export interface AppNotification {
  id: string;
  accountId: string;
  bookingId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  items: AppNotification[];
  pagination: Pagination;
}
