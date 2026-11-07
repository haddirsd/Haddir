"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase";
import { listAdminEvents } from "./admin-events.service";
import type { AdminEventRow } from "./admin-events.types";

export function useAdminEvents() {
  const [rows, setRows] = useState<AdminEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const refreshEvents = useCallback(async () => {
    setLoading(true);
    const result = await listAdminEvents();
    if (result.error) setLoadError(result.error);
    else { setRows(result.data); setLoadError(""); }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshEvents();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase.channel("admin-events-workspace")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => void refreshEvents())
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_types" }, () => void refreshEvents())
      .on("postgres_changes", { event: "*", schema: "public", table: "event_payment_accounts" }, () => void refreshEvents())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refreshEvents]);

  return { rows, loading, loadError, refreshEvents };
}
