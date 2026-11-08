"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase";
import { getAdminReportData } from "./admin-reports.service";
import type { AdminReportData } from "./admin-reports.types";

export function useAdminReports() {
  const [statistics, setStatistics] = useState<AdminReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    const result = await getAdminReportData();
    if (requestId !== latestRequest.current) return;
    if (result.error) setError(result.error);
    else { setStatistics(result.data); setError(""); }
    setLoading(false);
  }, []);

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

  return { statistics, loading, error, refresh };
}
