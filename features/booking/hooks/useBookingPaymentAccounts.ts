"use client";

import { useCallback, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { getEventPaymentAccounts } from "../services/booking.service";
import type { EventPaymentAccount } from "../types";

type SetBookingError = (message: string) => void;

export function useBookingPaymentAccounts(setBookingError: SetBookingError) {
  const [eventPaymentAccounts, setEventPaymentAccounts] = useState<EventPaymentAccount[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [accountCopied, setAccountCopied] = useState(false);
  const paymentAccountsRequest = useRef(0);

  const loadPaymentAccounts = useCallback(async (eventId: string) => {
    const requestId = ++paymentAccountsRequest.current;
    if (!getSupabaseBrowserClient()) return true;
    const { data, error } = await getEventPaymentAccounts(eventId);
    if (requestId !== paymentAccountsRequest.current) return false;
    if (error) {
      setBookingError("تعذر تحميل حسابات الدفع لهذه الفعالية: " + (error.message || ""));
      return false;
    }
    setEventPaymentAccounts(data || []);
    setPaymentMethod("");
    setAccountCopied(false);
    setBookingError("");
    return true;
  }, [setBookingError]);

  const copyAccount = useCallback(async (accountNumber: string) => {
    if (!accountNumber) return;
    try {
      await navigator.clipboard.writeText(accountNumber);
      setAccountCopied(true);
      window.setTimeout(() => setAccountCopied(false), 1800);
    } catch {
      setBookingError("تعذر نسخ رقم الحساب. يمكنك تحديد الرقم ونسخه يدوياً.");
    }
  }, [setBookingError]);

  const invalidatePaymentAccountsRequest = useCallback(() => {
    paymentAccountsRequest.current += 1;
  }, []);

  const resetPaymentAccounts = useCallback(() => {
    setEventPaymentAccounts([]);
    setPaymentMethod("");
    setAccountCopied(false);
  }, []);

  return {
    eventPaymentAccounts,
    paymentMethod,
    setPaymentMethod,
    accountCopied,
    setAccountCopied,
    loadPaymentAccounts,
    copyAccount,
    invalidatePaymentAccountsRequest,
    resetPaymentAccounts,
  };
}
