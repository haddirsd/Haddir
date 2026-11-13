"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { loadCustomerAccountData } from "../services/customer-account.service";
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

  return {
    myTickets,
    myNotifications,
    setMyNotifications,
    accountDataLoading,
    accountDataError,
    setAccountDataError,
  };
}
