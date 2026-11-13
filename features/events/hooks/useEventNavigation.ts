"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { EventItem } from "./types";

type AuthUser = { id: string; email?: string; user_metadata?: Record<string, unknown> } | null;

type UseEventNavigationOptions = {
  events: EventItem[];
  authUser: AuthUser;
  phone: string;
  onRequireLogin: () => void;
  onRequirePhone: () => void;
};

const clampQuantity = (value: string | null) => {
  const parsed = Number(value || 1);
  return Number.isFinite(parsed) ? Math.min(5, Math.max(1, parsed)) : 1;
};

export function useEventNavigation({
  events,
  authUser,
  phone,
  onRequireLogin,
  onRequirePhone,
}: UseEventNavigationOptions) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState(0);
  const [tierChosen, setTierChosen] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [ticketCount, setTicketCount] = useState(1);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  const syncFromLocation = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedEventId = params.get("event");

    if (!requestedEventId) {
      setSelectedEventId(null);
      setSelectedTier(0);
      setTierChosen(false);
      setTicketCount(1);
      setShowPayment(false);
      return;
    }

    const requestedEvent = events.find((event) => event.id === requestedEventId);
    if (!requestedEvent) return;

    const requestedTier = Number(params.get("tier") || 0);
    const validTier = Number.isInteger(requestedTier) && requestedTier >= 0 &&
      requestedTier < requestedEvent.tiers.length;

    setSelectedEventId(requestedEventId);
    setSelectedTier(validTier ? requestedTier : 0);
    setTierChosen(params.has("tier") && validTier);
    setTicketCount(clampQuantity(params.get("qty")));
    setShowPayment(params.get("checkout") === "1");
  }, [events]);

  useEffect(() => {
    syncFromLocation();
  }, [syncFromLocation]);

  useEffect(() => {
    const handleBrowserBack = () => syncFromLocation();
    window.addEventListener("popstate", handleBrowserBack);
    return () => window.removeEventListener("popstate", handleBrowserBack);
  }, [syncFromLocation]);

  const resetEventNavigation = useCallback(() => {
    setSelectedEventId(null);
    setSelectedTier(0);
    setTierChosen(false);
    setShowPayment(false);
    setTicketCount(1);

    const url = new URL(window.location.href);
    url.searchParams.delete("event");
    url.searchParams.delete("checkout");
    url.searchParams.delete("tier");
    url.searchParams.delete("qty");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }, []);

  const openEvent = useCallback((eventId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("event", eventId);
    url.searchParams.delete("checkout");
    url.searchParams.delete("tier");
    url.searchParams.delete("qty");
    window.history.pushState(
      { ...window.history.state, haddirPage: "event-detail" },
      "",
      url.pathname + url.search + url.hash
    );
    setSelectedEventId(eventId);
    setSelectedTier(0);
    setTierChosen(false);
    setShowPayment(false);
    setTicketCount(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const selectTier = useCallback((index: number) => {
    if (!selectedEvent || !selectedEvent.tiers[index]) return;
    setSelectedTier(index);
    setTierChosen(true);
    setTicketCount(1);
    const url = new URL(window.location.href);
    url.searchParams.set("tier", String(index));
    url.searchParams.set("qty", "1");
    window.history.replaceState(
      { ...window.history.state, haddirPage: "event-detail" },
      "",
      url.pathname + url.search + url.hash
    );
  }, [selectedEvent]);

  const changeQuantity = useCallback((quantity: number) => {
    const safeQuantity = Math.min(5, Math.max(1, Math.floor(quantity) || 1));
    setTicketCount(safeQuantity);
    const url = new URL(window.location.href);
    url.searchParams.set("qty", String(safeQuantity));
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);

  const continueToPayment = useCallback(async (loadPaymentAccounts: (eventId: string) => Promise<boolean>) => {
    if (!tierChosen || !selectedEvent) return;

    if (!authUser) {
      onRequireLogin();
      return;
    }

    const normalizedPhone = phone
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .replace(/\s+/g, "");
    if (!/^0\d{9}$/.test(normalizedPhone)) {
      onRequirePhone();
      return;
    }

    const eventId = selectedEvent.id;
    const loaded = await loadPaymentAccounts(eventId);
    if (!loaded || selectedEventId !== eventId) return;

    const url = new URL(window.location.href);
    url.searchParams.set("checkout", "1");
    url.searchParams.set("tier", String(selectedTier));
    url.searchParams.set("qty", String(ticketCount));
    window.history.pushState(
      { ...window.history.state, haddirPage: "event-payment" },
      "",
      url.pathname + url.search + url.hash
    );
    setShowPayment(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [authUser, phone, onRequireLogin, onRequirePhone, selectedEvent, selectedEventId, selectedTier, ticketCount, tierChosen]);

  const backToDetails = useCallback(() => {
    if ((window.history.state as { haddirPage?: string } | null)?.haddirPage === "event-payment") {
      window.history.back();
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    window.history.replaceState(
      { ...window.history.state, haddirPage: "event-detail" },
      "",
      url.pathname + url.search + url.hash
    );
    setShowPayment(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const closeEvent = useCallback(() => {
    const page = (window.history.state as { haddirPage?: string } | null)?.haddirPage;
    if (page === "event-detail" || page === "event-payment") {
      window.history.back();
      return;
    }
    resetEventNavigation();
  }, [resetEventNavigation]);

  return {
    selectedEvent,
    selectedEventId,
    selectedTier,
    tierChosen,
    showPayment,
    ticketCount,
    resetEventNavigation,
    openEvent,
    closeEvent,
    selectTier,
    changeQuantity,
    continueToPayment,
    backToDetails,
  };
}
