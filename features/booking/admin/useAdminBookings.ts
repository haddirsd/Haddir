"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase";
import { listAdminBookings } from "./admin-bookings.service";
import type { AdminBookingRow } from "./admin-bookings.types";

export function useAdminBookings(searchTerm: string) {
  const [rows, setRows] = useState<AdminBookingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    const result = await listAdminBookings(searchTerm);
    if (requestId !== latestRequest.current) return;
    if (result.error) setError(result.error);
    else { setRows(result.rows); setError(""); }
    setLoading(false);
  }, [searchTerm]);

  useEffect(() => {
    void refresh();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase.channel("admin-bookings-workspace")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "booking_items" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_submissions" }, () => void refresh())
      .subscribe();
    return () => {
      latestRequest.current += 1;
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { rows, loading, error, refresh };
}
