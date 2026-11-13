"use client";

import { useCallback, useMemo, useState } from "react";
import type { CustomerNotification } from "../types";

type NotificationFilter = "unread" | "read";

type UseCustomerNotificationViewOptions = {
  notifications: CustomerNotification[];
  markNotificationRead: (notificationId: string) => Promise<{ error?: string | null }>;
  markAllNotificationsRead: () => Promise<{ error?: string | null }>;
  onNavigateToTickets: () => void;
};

export function useCustomerNotificationView({
  notifications,
  markNotificationRead,
  markAllNotificationsRead,
  onNavigateToTickets,
}: UseCustomerNotificationViewOptions) {
  const [filter, setFilter] = useState<NotificationFilter>("unread");

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications],
  );

  const filteredNotifications = useMemo(
    () => notifications.filter((notification) => filter === "unread" ? !notification.is_read : notification.is_read),
    [notifications, filter],
  );

  const markOneRead = useCallback(async (notification: CustomerNotification) => {
    const result = await markNotificationRead(notification.id);
    if (!result.error) setFilter("read");
    return result;
  }, [markNotificationRead]);

  const markAllRead = useCallback(async () => {
    const result = await markAllNotificationsRead();
    if (!result.error) setFilter("read");
    return result;
  }, [markAllNotificationsRead]);

  const openNotification = useCallback(async (notification: CustomerNotification) => {
    if (!notification.is_read) await markOneRead(notification);
    if (
      notification.type === "ticket_approved" ||
      String(notification.type || "").startsWith("event_reminder_")
    ) {
      onNavigateToTickets();
    }
  }, [markOneRead, onNavigateToTickets]);

  return {
    filter,
    setFilter,
    unreadCount,
    filteredNotifications,
    markOneRead,
    markAllRead,
    openNotification,
  };
}
