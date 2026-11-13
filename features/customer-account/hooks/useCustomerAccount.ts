"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { loadCustomerAccountData, markCustomerNotificationRead, markAllCustomerNotificationsRead } from "../services/customer-account.service";
import type { CustomerNotification, CustomerTicket } from "../types";

export function useCustomerAccount(userId: string | null) {
  const [myTickets, setMyTickets] = useState<CustomerTicket[]>([]);
  const [myNotifications, setMyNotifications] = useState<CustomerNotification[]>([]);
  const [accountDataLoading, setAccountDataLoading] = useState(false);
  const [accountDataError, setAccountDataError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !userId) {
      setMyTickets([]);
      setMyNotifications([]);
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
      const result = await loadCustomerAccountData(userId);
      if (!alive || requestId !== requestSequence) return;
      if (result.error) {
        setAccountDataError(result.error);
      } else {
        setMyTickets(result.tickets);
        setMyNotifications(result.notifications);
        setAccountDataError("");
      }
      if (firstLoad) {
        setAccountDataLoading(false);
        firstLoad = false;
      }
    };

    void refresh();
    const channel = supabase.channel("customer-live-" + userId)
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => { void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: "user_id=eq." + userId }, () => { void refresh(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: "user_id=eq." + userId }, () => { void refresh(); })
      .subscribe((status) => { if (status === "SUBSCRIBED") void refresh(); });

    return () => {
      alive = false;
      requestSequence++;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    if (!userId) return { error: "سجّل الدخول أولاً." };
    const result = await markCustomerNotificationRead(userId, notificationId);
    if (result.error) {
      setAccountDataError("تعذر تحديث حالة الإشعار. " + result.error);
      return result;
    }
    setMyNotifications((rows) => rows.map((row) => row.id === notificationId ? { ...row, is_read: true } : row));
    return result;
  }, [userId]);

  const markAllNotificationsRead = useCallback(async () => {
    if (!userId) return { error: "سجّل الدخول أولاً." };
    const unreadIds = myNotifications.filter((notification) => !notification.is_read).map((notification) => notification.id);
    const result = await markAllCustomerNotificationsRead(userId, unreadIds);
    if (result.error) {
      setAccountDataError("تعذر تعليم الإشعارات كمقروءة. " + result.error);
      return result;
    }
    setMyNotifications((rows) => rows.map((row) => ({ ...row, is_read: true })));
    return result;
  }, [userId, myNotifications]);

  return {
    myTickets,
    myNotifications,
    setMyNotifications,
    accountDataLoading,
    accountDataError,
    setAccountDataError,
    markNotificationRead,
    markAllNotificationsRead,
  };
}
