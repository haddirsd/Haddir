import { getSupabaseBrowserClient } from "../../lib/supabase";
import type { BookingCreationResult, EventPaymentAccount } from "./booking.types";

type ServiceError = { message?: string } | null;
export type BookingPaymentSubmission = { id: string; status: string; receipt_path: string | null };

export async function getEventPaymentAccounts(eventId: string): Promise<{ data: EventPaymentAccount[] | null; error: ServiceError }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: null, error: { message: "تعذر الاتصال بقاعدة البيانات." } };
  const { data, error } = await supabase.from("event_payment_accounts")
    .select("id,account_name,account_number,beneficiary").eq("event_id", eventId)
    .eq("is_active", true).order("sort_order");
  return { data: (data as EventPaymentAccount[] | null) ?? null, error };
}

export async function createBooking(eventId: string, ticketTypeId: string, quantity: number): Promise<{ data: BookingCreationResult | null; error: ServiceError }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: null, error: { message: "تعذر الاتصال بقاعدة البيانات." } };
  const { data, error } = await supabase.rpc("create_booking", { p_event_id: eventId, p_ticket_type_id: ticketTypeId, p_quantity: quantity });
  if (error) return { data: null, error };
  const result = Array.isArray(data) ? data[0] : data;
  return { data: (result as BookingCreationResult | null) ?? null, error: null };
}

export async function uploadPaymentReceipt(userId: string, bookingId: string, receipt: File): Promise<{ path: string | null; error: ServiceError }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { path: null, error: { message: "تعذر الاتصال بقاعدة البيانات." } };
  const extension = receipt.type === "image/png" ? "png" : receipt.type === "image/webp" ? "webp" : "jpg";
  const path = userId + "/" + bookingId + "/" + crypto.randomUUID() + "." + extension;
  const { error } = await supabase.storage.from("payment-receipts").upload(path, receipt, { contentType: receipt.type, upsert: false, cacheControl: "3600" });
  return error ? { path: null, error } : { path, error: null };
}

export async function getBookingPaymentSubmission(bookingId: string): Promise<{ data: BookingPaymentSubmission | null; error: ServiceError }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: null, error: { message: "تعذر الاتصال بقاعدة البيانات." } };
  const { data, error } = await supabase.from("payment_submissions")
    .select("id,status,receipt_path").eq("booking_id", bookingId).maybeSingle();
  return { data: (data as BookingPaymentSubmission | null) ?? null, error };
}

export async function submitPayment(bookingId: string, paymentMethodId: string, receiptPath: string): Promise<{ data: string | null; error: ServiceError }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: null, error: { message: "تعذر الاتصال بقاعدة البيانات." } };
  const { data, error } = await supabase.rpc("submit_payment", {
    p_booking_id: bookingId, p_payment_method_id: paymentMethodId,
    p_receipt_path: receiptPath, p_transfer_reference: null,
  });
  return { data: (data as string | null) ?? null, error };
}

export async function removePaymentReceipt(path: string): Promise<{ error: ServiceError }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: { message: "تعذر الاتصال بقاعدة البيانات." } };
  const { error } = await supabase.storage.from("payment-receipts").remove([path]);
  return { error };
}
