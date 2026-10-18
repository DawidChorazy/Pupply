import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";

export async function listNotifications(
  accountId: string,
  input: { unreadOnly?: boolean; page: number; pageSize: number }
) {
  const where = { accountId, readAt: input.unreadOnly ? null : undefined };
  const [items, total] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize
    }),
    prisma.notification.count({ where })
  ]);
  return { items, pagination: { page: input.page, pageSize: input.pageSize, total } };
}

export async function unreadNotificationCount(accountId: string) {
  return prisma.notification.count({ where: { accountId, readAt: null } });
}

export async function markNotificationRead(accountId: string, notificationId: string) {
  const changed = await prisma.notification.updateMany({
    where: { id: notificationId, accountId },
    data: { readAt: new Date() }
  });
  if (!changed.count) throw new AppError(404, "Notification was not found", "NOTIFICATION_NOT_FOUND");
}

export async function markAllNotificationsRead(accountId: string) {
  return prisma.notification.updateMany({
    where: { accountId, readAt: null },
    data: { readAt: new Date() }
  });
}
