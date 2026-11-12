"use client";

import { useCallback, useEffect, useRef } from "react";
import { useBooking } from "../booking/useBooking";
import type { EventItem } from "./events.types";
import { useEventNavigation } from "./useEventNavigation";

type AuthUser = { id: string; email?: string; user_metadata?: Record<string, unknown> } | null;

type UseEventWorkspaceOptions = {
  events: EventItem[];
  authUser: AuthUser;
  phone: string;
  onRequireLogin: () => void;
  onRequirePhone: () => void;
  onBookingSuccess?: () => void;
};

/** Composes event URL/navigation state with the booking flow so the page only hosts the workspace. */
export function useEventWorkspace({
  events,
  authUser,
  phone,
  onRequireLogin,
  onRequirePhone,
  onBookingSuccess,
}: UseEventWorkspaceOptions) {
  const navigation = useEventNavigation({ events, authUser, phone, onRequireLogin, onRequirePhone });
  const booking = useBooking({
    authUser,
    selected: navigation.selectedEvent,
    selectedTier: navigation.selectedTier,
    ticketCount: navigation.ticketCount,
    onSuccess: onBookingSuccess,
  });

  const loadedAccountsFor = useRef<string | null>(null);
  const loadPaymentAccountsOnce = useCallback(async (eventId: string) => {
    if (loadedAccountsFor.current === eventId) return true;
    loadedAccountsFor.current = eventId;
    const loaded = await booking.loadPaymentAccounts(eventId);
    if (!loaded && loadedAccountsFor.current === eventId) loadedAccountsFor.current = null;
    return loaded;
  }, [booking.loadPaymentAccounts]);

  const previousEventId = useRef<string | null>(null);
  useEffect(() => {
    const eventId = navigation.selectedEvent?.id ?? null;
    if (previousEventId.current !== eventId) {
      previousEventId.current = eventId;
      loadedAccountsFor.current = null;
      booking.resetBooking();
    }
  }, [navigation.selectedEvent?.id, booking.resetBooking]);

  // A shared/direct URL may open the checkout screen without passing through the
  // "continue" button. Load that event's payment methods as part of workspace setup.
  useEffect(() => {
    if (navigation.showPayment && navigation.selectedEvent) {
      void loadPaymentAccountsOnce(navigation.selectedEvent.id);
    }
  }, [navigation.showPayment, navigation.selectedEvent?.id, loadPaymentAccountsOnce]);

  const openEvent = useCallback((eventId: string) => {
    booking.resetBooking();
    loadedAccountsFor.current = null;
    navigation.openEvent(eventId);
  }, [booking.resetBooking, navigation.openEvent]);

  const resetEventWorkspace = useCallback(() => {
    booking.resetBooking();
    loadedAccountsFor.current = null;
    navigation.resetEventNavigation();
  }, [booking.resetBooking, navigation.resetEventNavigation]);

  const continueToPayment = useCallback(() => {
    void navigation.continueToPayment(loadPaymentAccountsOnce);
  }, [navigation.continueToPayment, loadPaymentAccountsOnce]);

  return {
    ...navigation,
    ...booking,
    openEvent,
    resetEventWorkspace,
    continueToPayment,
  };
}
