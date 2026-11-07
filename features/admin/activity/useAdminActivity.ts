"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase";
import { listAdminActivity } from "./admin-activity.service";
import type { AdminActivityRow } from "./admin-activity.types";

export function useAdminActivity() {
  const [rows, setRows] = useState<AdminActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const latestRequest = useRef(0);
  const refresh = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    const result = await listAdminActivity();
    if (requestId !== latestRequest.current) return;
    if (result.error) setError(result.error);
    else { setRows(result.rows); setError(""); }
    setLoading(false);
  }, []);
  useEffect(() => {
    void refresh();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase.channel("admin-activity-workspace")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_activity_log" }, () => void refresh())
      .subscribe();
    return () => { latestRequest.current += 1; void supabase.removeChannel(channel); };
  }, [refresh]);
  return { rows, loading, error, refresh };
}
