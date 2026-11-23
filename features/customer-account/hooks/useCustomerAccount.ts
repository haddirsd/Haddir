"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import {
  CUSTOMER_NOTIFICATIONS_PAGE_SIZE,
  CUSTOMER_TICKETS_PAGE_SIZE,
  loadCustomerAccountData,
  loadCustomerNotifications,
  markCustomerNotificationRead,
  markAllCustomerNotificationsRead,
} from "../services/customer-account.service";
import type { CustomerNotification, CustomerTicket } from "../types";

type TicketStatus = "valid" | "used";
type NotificationFilter = "unread" | "read";

export function useCustomerAccount(
  userId: string | null,
  ticketStatus: TicketStatus,
  ticketPage: number,
  setTicketPage: (page: number) => void,
  notificationFilter: NotificationFilter,
  notificationPage: number,
  setNotificationPage: (page: number) => void,
) {
  const [myTickets, setMyTickets] = useState<CustomerTicket[]>([]);
  const [myTicketCounts, setMyTicketCounts] = useState({ valid: 0, used: 0 });
  const [myNotifications, setMyNotifications] = useState<CustomerNotification[]>([]);
  const [myNotificationsTotal, setMyNotificationsTotal] = useState(0);
  const [myNotificationsFilteredTotal, setMyNotificationsFilteredTotal] = useState(0);
  const [myUnreadNotificationCount, setMyUnreadNotificationCount] = useState(0);
  const [accountDataLoading, setAccountDataLoading] = useState(false);
  const [accountDataError, setAccountDataError] = useState("");
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const latestNotificationRequest = useRef(0);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !userId) {
      setMyTickets([]);
      setMyTicketCounts({ valid: 0, used: 0 });
      setAccountDataLoading(false);
      setAccountDataError("");
      return;
    }
    let alive = true;
    let firstLoad = true;
    let requestSequence = 0;
    setAccountDataLoading(true);
    setAccountDataError("");
    const refresh = async () => {
      const requestId = ++requestSequence;
      try {
        const result = await loadCustomerAccountData(userId, ticketStatus, ticketPage);
        if (!alive || requestId !== requestSequence) return;
        if (result.error) setAccountDataError(result.error);
        else {
          setMyTickets(result.tickets);
          setMyTicketCounts(result.ticketCounts);
          setAccountDataError("");
          const totalPages = Math.max(1, Math.ceil(result.ticketCounts[ticketStatus] / CUSTOMER_TICKETS_PAGE_SIZE));
          if (ticketPage > totalPages) setTicketPage(totalPages);
        }
      } catch (error) {
        if (alive && requestId === requestSequence) setAccountDataError(error instanceof Error ? error.message : "تعذر تحميل تذاكرك.");
      } finally {
        if (alive && requestId === requestSequence && firstLoad) {
          setAccountDataLoading(false);
          firstLoad = false;
        }
      }
    };
    void refresh();
    const channel = supabase.channel("customer-tickets-" + userId)
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => { void refresh(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: "user_id=eq." + userId }, () => { void refresh(); })
      .subscribe((status) => { if (status === "SUBSCRIBED") void refresh(); });
    return () => {
      alive = false;
      requestSequence++;
      void supabase.removeChannel(channel);
    };
  }, [userId, ticketStatus, ticketPage, setTicketPage]);

  const refreshNotifications = useCallback(async () => {
    if (!userId) return;
    const requestId = ++latestNotificationRequest.current;
    setNotificationsLoading(true);
    setNotificationsError("");
    try {
      const result = await loadCustomerNotifications(userId, notificationFilter, notificationPage);
      if (requestId !== latestNotificationRequest.current) return;
      if (result.error) setNotificationsError(result.error);
      else {
        const totalPages = Math.max(1, Math.ceil(result.filteredTotal / CUSTOMER_NOTIFICATIONS_PAGE_SIZE));
        if (notificationPage > totalPages) {
          setNotificationPage(totalPages);
          return;
        }
        setMyNotifications(result.notifications);
        setMyNotificationsTotal(result.total);
        setMyNotificationsFilteredTotal(result.filteredTotal);
        setMyUnreadNotificationCount(result.unreadCount);
      }
    } catch (error) {
      if (requestId === latestNotificationRequest.current) setNotificationsError(error instanceof Error ? error.message : "تعذر تحميل الإشعارات.");
    } finally {
      if (requestId === latestNotificationRequest.current) setNotificationsLoading(false);
    }
  }, [userId, notificationFilter, notificationPage, setNotificationPage]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !userId) {
      latestNotificationRequest.current++;
      setMyNotifications([]);
      setMyNotificationsTotal(0);
      setMyNotificationsFilteredTotal(0);
      setMyUnreadNotificationCount(0);
      setNotificationsLoading(false);
      setNotificationsError("");
      return;
    }
    void refreshNotifications();
    const channel = supabase.channel("customer-notifications-" + userId)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: "user_id=eq." + userId }, () => { void refreshNotifications(); })
      .subscribe((status) => { if (status === "SUBSCRIBED") void refreshNotifications(); });
    return () => {
      latestNotificationRequest.current++;
      void supabase.removeChannel(channel);
    };
  }, [userId, refreshNotifications]);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    if (!userId) return { error: "سجّل الدخول أولاً." };
    const result = await markCustomerNotificationRead(userId, notificationId);
    if (result.error) {
      setNotificationsError("تعذر تحديث حالة الإشعار. " + result.error);
      return result;
    }
    setMyNotifications((rows) => rows.map((row) => row.id === notificationId ? { ...row, is_read: true } : row));
    setMyUnreadNotificationCount((count) => Math.max(0, count - 1));
    return result;
  }, [userId]);

  const markAllNotificationsRead = useCallback(async () => {
    if (!userId) return { error: "سجّل الدخول أولاً." };
    const result = await markAllCustomerNotificationsRead(userId);
    if (result.error) {
      setNotificationsError("تعذر تعليم الإشعارات كمقروءة. " + result.error);
      return result;
    }
    setMyNotifications((rows) => rows.map((row) => ({ ...row, is_read: true })));
    setMyUnreadNotificationCount(0);
    return result;
  }, [userId]);

  return {
    myTickets,
    myTicketCounts,
    myNotifications,
    myNotificationsTotal,
    myNotificationsFilteredTotal,
    myUnreadNotificationCount,
    accountDataLoading,
    accountDataError,
    setAccountDataError,
    notificationsLoading,
    notificationsError,
    markNotificationRead,
    markAllNotificationsRead,
  };
}
