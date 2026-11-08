"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase";
import { getAdminOverviewStats } from "./admin-overview.service";
import type { AdminOverviewRole, AdminOverviewStats } from "./admin-overview.types";

const emptyStats: AdminOverviewStats = { events: 0, bookings: 0, pending: 0, users: 0, confirmed: 0, revenue: 0 };

export function useAdminOverview(role: AdminOverviewRole) {
  const [stats, setStats] = useState<AdminOverviewStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    const result = await getAdminOverviewStats(role);
    if (requestId !== latestRequest.current) return;
    if (result.error) setError(result.error);
    else { setStats(result.data || emptyStats); setError(""); }
    setLoading(false);
  }, [role]);

  useEffect(() => {
    void refresh();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let hasSubscribed = false;
    const channel = supabase.channel("admin-overview-workspace")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_submissions" }, () => void refresh())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (hasSubscribed) void refresh();
          hasSubscribed = true;
        }
      });
    return () => { latestRequest.current += 1; void supabase.removeChannel(channel); };
  }, [refresh]);

  return { stats, loading, error, refresh };
}
