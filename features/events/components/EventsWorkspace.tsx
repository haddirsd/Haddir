"use client";

import { useCallback, useEffect, useRef } from "react";
import { useEvents } from "../useEvents";
import { useEventWorkspace } from "../useEventWorkspace";
import { HomeEventsWorkspace } from "./HomeEventsWorkspace";
import { EventDetailWorkspace } from "./EventDetailWorkspace";

type EventsWorkspaceProps = {
  showHome: boolean;
  resetKey: number;
  onEventOpenChange: (open: boolean) => void;
  authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null;
  phone: string;
  onRequireLogin: () => void;
  onRequirePhone: () => void;
  onBookingSuccess: () => void;
  onGoNotifications: () => void;
};

/** Owns the complete public event experience: data, URLs, details and booking. */
export function EventsWorkspace({
  showHome,
  resetKey,
  onEventOpenChange,
  authUser,
  phone,
  onRequireLogin,
  onRequirePhone,
  onBookingSuccess,
  onGoNotifications,
}: EventsWorkspaceProps) {
  const { events, eventsLoading, eventsError, ticketTypesError, refreshEvents } = useEvents();
  const workspace = useEventWorkspace({
    events,
    authUser,
    phone,
    onRequireLogin,
    onRequirePhone,
    onBookingSuccess,
  });
  const {
    selectedEvent,
    selectedTier,
    tierChosen,
    showPayment,
    ticketCount,
    openEvent,
    closeEvent,
    selectTier,
    changeQuantity,
    continueToPayment,
    backToDetails,
    eventPaymentAccounts,
    paymentMethod,
    setPaymentMethod,
    receipt,
    setReceipt,
    bookingDone,
    bookingNumber,
    bookingError,
    setBookingError,
    bookingSubmitting,
    accountCopied,
    setAccountCopied,
    copyAccount,
    submitBooking,
    resetEventWorkspace,
  } = workspace;

  const previousResetKey = useRef(resetKey);
  useEffect(() => {
    if (previousResetKey.current === resetKey) return;
    previousResetKey.current = resetKey;
    resetEventWorkspace();
  }, [resetKey, resetEventWorkspace]);
  useEffect(() => { onEventOpenChange(!!selectedEvent); }, [selectedEvent?.id, onEventOpenChange]);

  const openPayment = useCallback(() => continueToPayment(), [continueToPayment]);
  const handlePaymentMethodChange = useCallback((value: string) => {
    setPaymentMethod(value);
    setAccountCopied(false);
    setBookingError("");
  }, [setPaymentMethod, setAccountCopied, setBookingError]);
  const goToNotifications = useCallback(() => {
    resetEventWorkspace();
    onGoNotifications();
  }, [resetEventWorkspace, onGoNotifications]);

  return (
    <>
      {showHome && !selectedEvent && (
        <HomeEventsWorkspace
          events={events}
          loading={eventsLoading}
          error={eventsError}
          onOpenEvent={openEvent}
          onRetry={() => void refreshEvents()}
        />
      )}
      {selectedEvent && (
        <EventDetailWorkspace
          event={selectedEvent}
          showPayment={showPayment}
          selectedTier={selectedTier}
          tierChosen={tierChosen}
          ticketCount={ticketCount}
          ticketTypesError={ticketTypesError}
          paymentAccounts={eventPaymentAccounts}
          paymentMethod={paymentMethod}
          receipt={receipt}
          bookingDone={bookingDone}
          bookingNumber={bookingNumber}
          bookingError={bookingError}
          bookingSubmitting={bookingSubmitting}
          accountCopied={accountCopied}
          onClose={closeEvent}
          onSelectTier={selectTier}
          onQuantityChange={changeQuantity}
          onContinueToPayment={openPayment}
          onRetryTicketTypes={() => void refreshEvents()}
          onBackToDetails={backToDetails}
          onPaymentMethodChange={handlePaymentMethodChange}
          onCopyAccount={copyAccount}
          onReceiptChange={setReceipt}
          onSubmitBooking={submitBooking}
          onGoNotifications={goToNotifications}
        />
      )}
    </>
  );
}
