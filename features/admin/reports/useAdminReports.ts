"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { getAdminEventReportPage, getAdminReportData } from "./admin-reports.service";
import type { AdminEventReportPage, AdminReportData } from "./admin-reports.types";

export function useAdminReports(eventId: string, bookingsPage: number, ticketsPage: number, eventsPage: number) {
  const [statistics, setStatistics] = useState<AdminReportData | null>(null);
  const [eventPage, setEventPage] = useState<AdminEventReportPage>({ bookings: [], tickets: [], bookingTotal: 0, ticketTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    setError("");
    try {
      const [summaryResult, pageResult] = await Promise.all([
        getAdminReportData(eventsPage),
        getAdminEventReportPage(eventId, bookingsPage, ticketsPage),
      ]);
      if (requestId !== latestRequest.current) return;
      if (summaryResult.error || pageResult.error) setError(summaryResult.error || pageResult.error || "تعذر تحميل التقارير.");
      else {
        setStatistics(summaryResult.data);
        setEventPage(pageResult.data);
      }
    } catch (error) {
      if (requestId === latestRequest.current) setError(error instanceof Error ? error.message : "تعذر تحميل التقارير.");
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [eventId, bookingsPage, ticketsPage, eventsPage]);

  useEffect(() => {
    void refresh();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let hasSubscribed = false;
    const channel = supabase.channel("admin-reports-workspace")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_types" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "booking_items" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => void refresh())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (hasSubscribed) void refresh();
          hasSubscribed = true;
        }
      });
    return () => {
      latestRequest.current += 1;
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { statistics, eventPage, loading, error, refresh };
}
