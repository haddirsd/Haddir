"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import {
  getPublishedEventById,
  getPublishedEvents,
} from "../services/events.service";
import type { EventItem } from "../types";

type RealtimePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, any>;
  old: Record<string, any>;
};

export function useEvents() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");
  const [ticketTypesError, setTicketTypesError] = useState("");
  const latestRequest = useRef(0);
  const eventsRef = useRef<EventItem[]>([]);
  const initialLoadComplete = useRef(false);
  const pendingEventIds = useRef(new Set<string>());
  const eventRequestVersions = useRef(new Map<string, number>());

  eventsRef.current = events;

  const refreshEvent = useCallback(async (eventId: string) => {
    const version = (eventRequestVersions.current.get(eventId) || 0) + 1;
    eventRequestVersions.current.set(eventId, version);
    const existingIndex = eventsRef.current.findIndex((event) => event.id === eventId);

    try {
      const result = await getPublishedEventById(eventId, Math.max(0, existingIndex));
      if (eventRequestVersions.current.get(eventId) !== version) return;

      setEvents((current) => {
        const currentIndex = current.findIndex((event) => event.id === eventId);
        if (!result.event) {
          return currentIndex === -1
            ? current
            : current.filter((event) => event.id !== eventId);
        }
        const next =
          currentIndex === -1
            ? [...current, result.event]
            : current.map((event, index) =>
                index === currentIndex ? result.event! : event
              );
        return next.sort((a, b) => {
          const aTime = a.startsAt ? new Date(a.startsAt).getTime() : Infinity;
          const bTime = b.startsAt ? new Date(b.startsAt).getTime() : Infinity;
          return aTime - bTime;
        });
      });
      setTicketTypesError(result.ticketTypesError);
      setEventsError("");
    } catch (error) {
      if (eventRequestVersions.current.get(eventId) !== version) return;
      setEventsError(
        error instanceof Error ? error.message : "تعذر تحديث الفعالية."
      );
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setEventsLoading(true);
    setEventsError("");

    try {
      const result = await getPublishedEvents();
      if (requestId !== latestRequest.current) return;
      setEvents(result.events);
      setTicketTypesError(result.ticketTypesError);
      initialLoadComplete.current = true;

      const pendingIds = Array.from(pendingEventIds.current);
      pendingEventIds.current.clear();
      pendingIds.forEach((eventId) => void refreshEvent(eventId));
    } catch (error) {
      if (requestId !== latestRequest.current) return;
      setEventsError(
        error instanceof Error ? error.message : "تعذر تحميل الفعاليات."
      );
    } finally {
      if (requestId === latestRequest.current) setEventsLoading(false);
    }
  }, [refreshEvent]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setEventsError("إعدادات الاتصال بقاعدة البيانات غير مكتملة.");
      setEventsLoading(false);
      return;
    }

    const queueOrRefresh = (eventId: string | null | undefined) => {
      if (!eventId) return;
      if (!initialLoadComplete.current) {
        pendingEventIds.current.add(eventId);
        return;
      }
      void refreshEvent(eventId);
    };

    const channel = supabase
      .channel("public-events-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        (payload: RealtimePayload) => {
          const row = payload.eventType === "DELETE" ? payload.old : payload.new;
          queueOrRefresh(row?.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_types" },
        (payload: RealtimePayload) => {
          const newEventId = payload.new?.event_id as string | undefined;
          const oldEventId = payload.old?.event_id as string | undefined;
          const ticketId = payload.old?.id || payload.new?.id;
          const knownEventId =
            eventsRef.current.find((event) =>
              event.tiers.some((tier) => tier.id === ticketId)
            )?.id || undefined;

          queueOrRefresh(newEventId || oldEventId || knownEventId);
          if (newEventId && oldEventId && newEventId !== oldEventId) {
            queueOrRefresh(oldEventId);
          }
        }
      )
      .subscribe();

    void refreshEvents();

    return () => {
      latestRequest.current += 1;
      initialLoadComplete.current = false;
      pendingEventIds.current.clear();
      eventRequestVersions.current.clear();
      void supabase.removeChannel(channel);
    };
  }, [refreshEvent, refreshEvents]);

  return { events, eventsLoading, eventsError, ticketTypesError, refreshEvents };
}
