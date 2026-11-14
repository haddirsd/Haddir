"use client";

import { useCallback, useRef } from "react";
import type { FormEvent, Dispatch, SetStateAction } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import {
  createBooking,
  uploadPaymentReceipt,
  getBookingPaymentSubmission,
  submitPayment,
} from "../services/booking.service";
import type { EventPaymentAccount } from "../types";

type BookingUser = { id: string } | null;
type BookingEvent = { id: string; tiers: Array<{ id: string }> } | null;
type BookingContext = { eventId: string; ticketTypeId: string; quantity: number; createdAt: number };
type PendingReceiptUpload = { bookingId: string; file: File; path: string };

type UseBookingSubmissionOptions = {
  authUser: BookingUser;
  selected: BookingEvent;
  selectedTier: number;
  ticketCount: number;
  receipt: File | null;
  eventPaymentAccounts: EventPaymentAccount[];
  paymentMethod: string;
  bookingId: string | null;
  bookingContext: BookingContext | null;
  setBookingId: Dispatch<SetStateAction<string | null>>;
  setBookingNumber: Dispatch<SetStateAction<string>>;
  setBookingContext: Dispatch<SetStateAction<BookingContext | null>>;
  setBookingDone: Dispatch<SetStateAction<boolean>>;
  setBookingError: Dispatch<SetStateAction<string>>;
  setBookingSubmitting: Dispatch<SetStateAction<boolean>>;
  onSuccess?: () => void;
};

export function useBookingSubmission({
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
}: UseBookingSubmissionOptions) {
  const submissionLock = useRef(false);
  const pendingReceiptUpload = useRef<PendingReceiptUpload | null>(null);

  const submitBooking = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submissionLock.current) return;
    if (!receipt) { setBookingError("ارفع صورة إيصال التحويل أولاً."); return; }
    if (!authUser || !selected || !selected.tiers[selectedTier]) { setBookingError("انتهت جلسة الحجز. سجّل الدخول وحاول مرة أخرى."); return; }
    if (!eventPaymentAccounts.some((account) => account.id === paymentMethod)) { setBookingError("اختر حساب دفع متاح لهذه الفعالية."); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(receipt.type)) { setBookingError("الصيغ المدعومة: JPG أو PNG أو WebP."); return; }
    if (receipt.size > 5 * 1024 * 1024) { setBookingError("حجم الإيصال يجب ألا يتجاوز 5 ميجابايت."); return; }
    if (!getSupabaseBrowserClient()) { setBookingError("تعذر الاتصال بقاعدة البيانات حالياً."); return; }

    submissionLock.current = true;
    setBookingSubmitting(true);
    setBookingError("");
    const selection = { eventId: selected.id, ticketTypeId: selected.tiers[selectedTier].id, quantity: ticketCount };
    const contextMatches = !!bookingContext &&
      bookingContext.eventId === selection.eventId &&
      bookingContext.ticketTypeId === selection.ticketTypeId &&
      bookingContext.quantity === selection.quantity &&
      Date.now() - bookingContext.createdAt < 19 * 60 * 1000;
    let activeBookingId = contextMatches ? bookingId : null;

    try {
      if (!activeBookingId) {
        setBookingId(null); setBookingNumber(""); setBookingContext(null);
        pendingReceiptUpload.current = null;
        const { data: created, error } = await createBooking(selected.id, selected.tiers[selectedTier].id, ticketCount);
        if (error) { setBookingError(error.message || "ما قدرنا ننشئ الحجز."); return; }
        if (!created?.booking_id) { setBookingError("لم نستلم تأكيد إنشاء الحجز."); return; }
        activeBookingId = created.booking_id;
        setBookingId(activeBookingId);
        setBookingNumber(created.booking_number || "");
        setBookingContext({ ...selection, createdAt: Date.now() });
      }

      // Recover a committed payment when the browser lost the RPC response.
      const { data: existing, error: lookupError } = await getBookingPaymentSubmission(activeBookingId);
      if (lookupError) { setBookingError("تعذر التأكد من حالة إثبات الدفع. احتفظنا بالإيصال؛ حاول مرة أخرى بعد استقرار الاتصال."); return; }
      if (existing) {
        setBookingDone(true);
        pendingReceiptUpload.current = null;
        onSuccess?.();
        return;
      }

      let receiptPath = pendingReceiptUpload.current?.bookingId === activeBookingId && pendingReceiptUpload.current.file === receipt
        ? pendingReceiptUpload.current.path : null;
      if (!receiptPath) {
        const { path, error: uploadError } = await uploadPaymentReceipt(authUser.id, activeBookingId, receipt);
        if (uploadError || !path) {
          setBookingError("تم حفظ الحجز لكن تعذر رفع الإيصال: " + (uploadError?.message || "تعذر تحديد مسار الإيصال") + ". يمكنك المحاولة مرة أخرى.");
          return;
        }
        receiptPath = path;
        pendingReceiptUpload.current = { bookingId: activeBookingId, file: receipt, path };
      }

      const { data: submissionId, error: submitError } = await submitPayment(activeBookingId, paymentMethod, receiptPath);
      if (submitError || !submissionId) {
        // Never remove a receipt on an ambiguous network error; the server may have committed it.
        const { data: recovered, error: recoveryError } = await getBookingPaymentSubmission(activeBookingId);
        if (!recoveryError && recovered) {
          setBookingDone(true); pendingReceiptUpload.current = null; onSuccess?.(); return;
        }
        setBookingError(recoveryError
          ? "تعذر التأكد هل وصل إثبات الدفع أم لا. احتفظنا بالإيصال؛ أعد المحاولة بعد التحقق من الاتصال."
          : (submitError?.message || "تعذر إرسال إثبات الدفع للمراجعة. يمكنك المحاولة مرة أخرى."));
        return;
      }

      pendingReceiptUpload.current = null;
      setBookingDone(true);
      onSuccess?.();
    } catch (error) {
      console.error("Booking submission failed", error);
      setBookingError(error instanceof Error && error.message ? error.message : "حصل خطأ غير متوقع أثناء إرسال الحجز. احتفظنا بالإيصال لتتمكن من إعادة المحاولة.");
    } finally {
      submissionLock.current = false;
      setBookingSubmitting(false);
    }
  }, [authUser, selected, selectedTier, ticketCount, receipt, eventPaymentAccounts, paymentMethod, bookingId, bookingContext, onSuccess, setBookingError, setBookingSubmitting, setBookingId, setBookingNumber, setBookingContext, setBookingDone]);

  const resetSubmission = useCallback(() => {
    pendingReceiptUpload.current = null;
  }, []);

  return { submitBooking, resetSubmission };
}
