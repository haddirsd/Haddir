"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { listAdminEvents } from "./admin-events.service";
import type { AdminEventRow } from "./admin-events.types";

const PAGE_SIZE = 25;

export function useAdminEvents() {
  const [rows, setRows] = useState<AdminEventRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const latestRequest = useRef(0);

  const refreshEvents = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    setLoadError("");
    try {
      const result = await listAdminEvents(page);
      if (requestId !== latestRequest.current) return;
      if (result.error) {
        setLoadError(result.error);
      } else {
        setRows(result.data);
        setTotalCount(result.total);
        const lastPage = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
        if (page > lastPage) setPage(lastPage);
      }
    } catch (error) {
      if (requestId === latestRequest.current) setLoadError(error instanceof Error ? error.message : "تعذر تحميل الفعاليات.");
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void refreshEvents();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase.channel("admin-events-workspace")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => void refreshEvents())
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_types" }, () => void refreshEvents())
      .on("postgres_changes", { event: "*", schema: "public", table: "event_payment_accounts" }, () => void refreshEvents())
      .subscribe();
    return () => { latestRequest.current += 1; void supabase.removeChannel(channel); };
  }, [refreshEvents]);

  return { rows, page, setPage, totalCount, loading, loadError, refreshEvents };
}
