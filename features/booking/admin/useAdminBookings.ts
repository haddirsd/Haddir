"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { listAdminBookings } from "./admin-bookings.service";
import type { AdminBookingRow } from "./admin-bookings.types";

export function useAdminBookings(searchTerm: string, page: number) {
  const [rows, setRows] = useState<AdminBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    setError("");
    try {
      const result = await listAdminBookings(searchTerm, page);
      if (requestId !== latestRequest.current) return;
      if (result.error) setError(result.error);
      else { setRows(result.rows); setTotalCount(result.totalCount); }
    } catch (error) {
      if (requestId === latestRequest.current) setError(error instanceof Error ? error.message : "تعذر تحميل الحجوزات.");
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [searchTerm, page]);

  useEffect(() => {
    void refresh();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let hasSubscribed = false;
    const channel = supabase.channel("admin-bookings-workspace")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "booking_items" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_submissions" }, () => void refresh())
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

  return { rows, totalCount, loading, error, refresh };
}
