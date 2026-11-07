"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import { getPublishedEvents } from "./events.service";
import type { EventItem } from "./events.types";

export function useEvents() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");
  const [ticketTypesError, setTicketTypesError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setEventsError("إعدادات الاتصال بقاعدة البيانات غير مكتملة.");
      setEventsLoading(false);
      return;
    }

    let alive = true;

    const loadEvents = async () => {
      setEventsLoading(true);
      setEventsError("");

      try {
        const result = await getPublishedEvents();
        if (!alive) return;
        setEvents(result.events);
        setTicketTypesError(result.ticketTypesError);
        setEventsLoading(false);
      } catch (error) {
        if (!alive) return;
        setEventsError(
          error instanceof Error ? error.message : "تعذر تحميل الفعاليات."
        );
        setEventsLoading(false);
      }
    };

    void loadEvents();

    const channel = supabase
      .channel("public-events-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => void loadEvents()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_types" },
        () => void loadEvents()
      )
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  return { events, eventsLoading, eventsError, ticketTypesError };
}
