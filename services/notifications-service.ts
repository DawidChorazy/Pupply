import { API_ENDPOINTS } from "@/constants/api";
import { NotificationsResponse } from "@/types/notifications";

import { authenticatedApiRequest } from "./api-client";

export function listNotifications(params: { unreadOnly?: boolean; page?: number; pageSize?: number } = {}) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return authenticatedApiRequest<NotificationsResponse>(
    `${API_ENDPOINTS.notifications.list}${query ? `?${query}` : ""}`
  );
}

export function getUnreadNotificationCount() {
  return authenticatedApiRequest<{ count: number }>(API_ENDPOINTS.notifications.unreadCount);
}

export function markNotificationRead(notificationId: string) {
  return authenticatedApiRequest<void>(API_ENDPOINTS.notifications.read(notificationId), {
    method: "PATCH"
  });
}

export function markAllNotificationsRead() {
  return authenticatedApiRequest<{ updated: number }>(API_ENDPOINTS.notifications.readAll, {
    method: "POST"
  });
}
