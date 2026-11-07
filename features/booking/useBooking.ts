"use client";

import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import {
  getEventPaymentAccounts,
  createBooking,
  uploadPaymentReceipt,
  submitPayment,
  removePaymentReceipt,
} from "./booking.service";
import type { EventPaymentAccount } from "./booking.types";

type BookingUser = { id: string } | null;
type BookingEvent = { id: string; tiers: Array<{ id: string }> } | null;

type UseBookingOptions = {
  authUser: BookingUser;
  selected: BookingEvent;
  selectedTier: number;
  ticketCount: number;
  onSuccess?: () => void;
};

export function useBooking({
  authUser,
  selected,
  selectedTier,
  ticketCount,
  onSuccess,
}: UseBookingOptions) {
  const [eventPaymentAccounts, setEventPaymentAccounts] = useState<EventPaymentAccount[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [bookingDone, setBookingDone] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingNumber, setBookingNumber] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [accountCopied, setAccountCopied] = useState(false);

  const loadPaymentAccounts = useCallback(async (eventId: string) => {
    // Keep the previous fallback: if Supabase is unavailable, checkout can still open.
    if (!getSupabaseBrowserClient()) return true;
    const { data, error } = await getEventPaymentAccounts(eventId);
    if (error) {
      setBookingError("تعذر تحميل حسابات الدفع لهذه الفعالية: " + (error.message || ""));
      return false;
    }
    setEventPaymentAccounts(data || []);
    setPaymentMethod("");
    setAccountCopied(false);
    setBookingError("");
    return true;
  }, []);

  const copyAccount = useCallback(async (accountNumber: string) => {
    if (!accountNumber) return;
    try {
      await navigator.clipboard.writeText(accountNumber);
      setAccountCopied(true);
      window.setTimeout(() => setAccountCopied(false), 1800);
    } catch {
      setBookingError("تعذر نسخ رقم الحساب. يمكنك تحديد الرقم ونسخه يدوياً.");
    }
  }, []);

  const submitBooking = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!receipt) {
      setBookingError("ارفع صورة إيصال التحويل أولاً.");
      return;
    }
    if (!authUser || !selected || !selected.tiers[selectedTier]) {
      setBookingError("انتهت جلسة الحجز. سجّل الدخول وحاول مرة أخرى.");
      return;
    }
    if (!eventPaymentAccounts.some((account) => account.id === paymentMethod)) {
      setBookingError("اختر حساب دفع متاح لهذه الفعالية.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(receipt.type)) {
      setBookingError("الصيغ المدعومة: JPG أو PNG أو WebP.");
      return;
    }
    if (receipt.size > 5 * 1024 * 1024) {
      setBookingError("حجم الإيصال يجب ألا يتجاوز 5 ميجابايت.");
      return;
    }
    if (!getSupabaseBrowserClient()) {
      setBookingError("تعذر الاتصال بقاعدة البيانات حالياً.");
      return;
    }

    setBookingSubmitting(true);
    setBookingError("");
    let activeBookingId = bookingId;
    let uploadedReceiptPath: string | null = null;

    try {
      if (!activeBookingId) {
        const { data: created, error } = await createBooking(
          selected.id,
          selected.tiers[selectedTier].id,
          ticketCount,
        );
        if (error) {
          setBookingError(error.message || "ما قدرنا ننشئ الحجز.");
          return;
        }
        if (!created?.booking_id) {
          setBookingError("لم نستلم تأكيد إنشاء الحجز.");
          return;
        }
        activeBookingId = created.booking_id;
        setBookingId(activeBookingId);
        setBookingNumber(created.booking_number || "");
      }

      const { path: receiptPath, error: uploadError } = await uploadPaymentReceipt(
        authUser.id,
        activeBookingId,
        receipt,
      );
      if (uploadError || !receiptPath) {
        setBookingError(
          "تم حفظ الحجز لكن تعذر رفع الإيصال: " +
            (uploadError?.message || "تعذر تحديد مسار الإيصال") +
            ". يمكنك المحاولة مرة أخرى.",
        );
        return;
      }

      uploadedReceiptPath = receiptPath;
      const { data: submissionId, error: submitError } = await submitPayment(
        activeBookingId,
        paymentMethod,
        receiptPath,
      );
      if (submitError || !submissionId) {
        await removePaymentReceipt(receiptPath);
        uploadedReceiptPath = null;
        setBookingError(submitError?.message || "تعذر إرسال إثبات الدفع للمراجعة. حاول مرة أخرى.");
        return;
      }

      uploadedReceiptPath = null;
      setBookingDone(true);
      onSuccess?.();
    } catch (error) {
      if (uploadedReceiptPath) {
        try {
          await removePaymentReceipt(uploadedReceiptPath);
        } catch (cleanupError) {
          console.error("Could not remove unsubmitted payment receipt", cleanupError);
        }
      }
      console.error("Booking submission failed", error);
      setBookingError(
        error instanceof Error && error.message
          ? error.message
          : "حصل خطأ غير متوقع أثناء إرسال الحجز. حاول مرة أخرى.",
      );
    } finally {
      setBookingSubmitting(false);
    }
  }, [authUser, selected, selectedTier, ticketCount, receipt, eventPaymentAccounts, paymentMethod, bookingId, onSuccess]);

  const resetBooking = useCallback(() => {
    setEventPaymentAccounts([]);
    setPaymentMethod("");
    setReceipt(null);
    setBookingDone(false);
    setBookingId(null);
    setBookingNumber("");
    setBookingError("");
    setBookingSubmitting(false);
    setAccountCopied(false);
  }, []);

  return {
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
    loadPaymentAccounts,
    copyAccount,
    submitBooking,
    resetBooking,
  };
}
