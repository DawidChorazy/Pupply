import { Pagination } from "@/features/marketplace/types/marketplace";

export type NotificationType =
  | "NEW_MESSAGE"
  | "BOOKING_REQUESTED"
  | "BOOKING_ACCEPTED"
  | "BOOKING_REJECTED"
  | "BOOKING_CANCELLED"
  | "BOOKING_COMPLETED"
  | "BOOKING_EXPIRED"
  | "DOCUMENT_EXPIRING";

export interface AppNotification {
  id: string;
  accountId: string;
  bookingId: string | null;
  conversationId?: string | null;
  chatMessageId?: string | null;
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
