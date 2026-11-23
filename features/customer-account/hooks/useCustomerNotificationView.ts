"use client";

import { useCallback } from "react";
import type { CustomerNotification } from "../types";

type NotificationFilter = "unread" | "read";

type UseCustomerNotificationViewOptions = {
  notifications: CustomerNotification[];
  filter: NotificationFilter;
  setFilter: (filter: NotificationFilter) => void;
  page: number;
  setPage: (page: number) => void;
  unreadCount: number;
  filteredTotal: number;
  markNotificationRead: (notificationId: string) => Promise<{ error?: string | null }>;
  markAllNotificationsRead: () => Promise<{ error?: string | null }>;
  onNavigateToTickets: () => void;
};

export function useCustomerNotificationView({
  notifications,
  filter,
  setFilter,
  page,
  setPage,
  unreadCount,
  filteredTotal,
  markNotificationRead,
  markAllNotificationsRead,
  onNavigateToTickets,
}: UseCustomerNotificationViewOptions) {
  const markOneRead = useCallback(async (notification: CustomerNotification) => {
    const result = await markNotificationRead(notification.id);
    if (!result.error) {
      setFilter("read");
      setPage(1);
    }
    return result;
  }, [markNotificationRead, setFilter, setPage]);

  const markAllRead = useCallback(async () => {
    const result = await markAllNotificationsRead();
    if (!result.error) {
      setFilter("read");
      setPage(1);
    }
    return result;
  }, [markAllNotificationsRead, setFilter, setPage]);

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
    setFilter: (nextFilter: NotificationFilter) => {
      setFilter(nextFilter);
      setPage(1);
    },
    page,
    setPage,
    unreadCount,
    filteredTotal,
    filteredNotifications: notifications,
    markOneRead,
    markAllRead,
    openNotification,
  };
}
