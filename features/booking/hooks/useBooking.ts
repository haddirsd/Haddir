"use client";

import { useCallback, useState } from "react";
import { useBookingPaymentAccounts } from "./useBookingPaymentAccounts";
import { useBookingSubmission } from "./useBookingSubmission";

type BookingUser = { id: string } | null;
type BookingEvent = { id: string; tiers: Array<{ id: string }> } | null;
type UseBookingOptions = { authUser: BookingUser; selected: BookingEvent; selectedTier: number; ticketCount: number; onSuccess?: () => void };

export function useBooking({ authUser, selected, selectedTier, ticketCount, onSuccess }: UseBookingOptions) {
  const [receipt, setReceipt] = useState<File | null>(null);
  const [bookingDone, setBookingDone] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingNumber, setBookingNumber] = useState("");
  const [bookingContext, setBookingContext] = useState<{ eventId: string; ticketTypeId: string; quantity: number; createdAt: number } | null>(null);
  const [bookingError, setBookingError] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  const {
    eventPaymentAccounts,
    paymentMethod,
    setPaymentMethod,
    accountCopied,
    setAccountCopied,
    loadPaymentAccounts,
    copyAccount,
    invalidatePaymentAccountsRequest,
    resetPaymentAccounts,
  } = useBookingPaymentAccounts(setBookingError);

  const { submitBooking, resetSubmission } = useBookingSubmission({
    authUser,
    selected,
    selectedTier,
    ticketCount,
    receipt,
    eventPaymentAccounts,
    paymentMethod,
    bookingId,
    bookingContext,
    setBookingId,
    setBookingNumber,
    setBookingContext,
    setBookingDone,
    setBookingError,
    setBookingSubmitting,
    onSuccess,
  });

  const resetBooking = useCallback(() => {
    invalidatePaymentAccountsRequest();
    resetPaymentAccounts();
    setReceipt(null); setBookingDone(false);
    setBookingId(null); setBookingNumber(""); setBookingContext(null); setBookingError("");
    setBookingSubmitting(false); setAccountCopied(false); resetSubmission();
  }, [invalidatePaymentAccountsRequest, resetPaymentAccounts, resetSubmission]);

  return {
    eventPaymentAccounts, paymentMethod, setPaymentMethod, receipt, setReceipt, bookingDone,
    bookingNumber, bookingError, setBookingError, bookingSubmitting, accountCopied,
    setAccountCopied, loadPaymentAccounts, copyAccount, submitBooking, resetBooking,
  };
}
