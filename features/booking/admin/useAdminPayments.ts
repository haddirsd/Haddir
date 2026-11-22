"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { listAdminPayments } from "./admin-payments.service";
import type { AdminPaymentRow } from "./admin-payments.types";

export function useAdminPayments(page: number, eventId: string | null = null) {
  const [rows, setRows] = useState<AdminPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    const result = await listAdminPayments(page, eventId);
    if (requestId !== latestRequest.current) return;
    if (result.error) setError(result.error);
    else { setRows(result.rows); setTotalCount(result.totalCount); setError(""); }
    setLoading(false);
  }, [page, eventId]);

  useEffect(() => {
    void refresh();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let hasSubscribed = false;
    const channel = supabase.channel("admin-payments-workspace")
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_submissions" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "booking_items" }, () => void refresh())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (hasSubscribed) void refresh();
          hasSubscribed = true;
        }
      });
    return () => { latestRequest.current += 1; void supabase.removeChannel(channel); };
  }, [refresh]);

  return { rows, totalCount, loading, error, refresh };
}
