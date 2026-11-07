"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import { getPublishedEvents } from "./events.service";
import type { EventItem } from "./events.types";

export function useEvents() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");
  const [ticketTypesError, setTicketTypesError] = useState("");
  const latestRequest = useRef(0);

  const refreshEvents = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setEventsLoading(true);
    setEventsError("");

    try {
      const result = await getPublishedEvents();
      if (requestId !== latestRequest.current) return;
      setEvents(result.events);
      setTicketTypesError(result.ticketTypesError);
    } catch (error) {
      if (requestId !== latestRequest.current) return;
      setEventsError(
        error instanceof Error ? error.message : "تعذر تحميل الفعاليات."
      );
    } finally {
      if (requestId === latestRequest.current) setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setEventsError("إعدادات الاتصال بقاعدة البيانات غير مكتملة.");
      setEventsLoading(false);
      return;
    }

    void refreshEvents();

    const channel = supabase
      .channel("public-events-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => void refreshEvents()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_types" },
        () => void refreshEvents()
      )
      .subscribe();

    return () => {
      latestRequest.current += 1;
      void supabase.removeChannel(channel);
    };
  }, [refreshEvents]);

  return { events, eventsLoading, eventsError, ticketTypesError, refreshEvents };
}
