"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { listAdminActivity, type AdminActivityFilters } from "./admin-activity.service";
import type { AdminActivityRow } from "./admin-activity.types";

export const ADMIN_ACTIVITY_PAGE_SIZE = 50;

export function useAdminActivity(page: number, filters: AdminActivityFilters) {
  const [rows, setRows] = useState<AdminActivityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const latestRequest = useRef(0);
  const refresh = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    const result = await listAdminActivity(page, ADMIN_ACTIVITY_PAGE_SIZE, filters);
    if (requestId !== latestRequest.current) return;
    if (result.error) setError(result.error);
    else {
      setRows(result.rows);
      setTotal(result.total);
      setError("");
    }
    setLoading(false);
  }, [page, filters.search, filters.role, filters.group, filters.period]);
  useEffect(() => {
    void refresh();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let hasSubscribed = false;
    const channel = supabase.channel("admin-activity-workspace")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_activity_log" }, () => void refresh())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (hasSubscribed) void refresh();
          hasSubscribed = true;
        }
      });
    return () => { latestRequest.current += 1; void supabase.removeChannel(channel); };
  }, [refresh]);
  return { rows, total, loading, error, refresh };
}
