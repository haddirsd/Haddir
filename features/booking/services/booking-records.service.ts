import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import type { BookingCreationResult, EventPaymentAccount } from "../types";

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

export async function getBookingPaymentSubmission(bookingId: string): Promise<{ data: BookingPaymentSubmission | null; error: ServiceError }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: null, error: { message: "تعذر الاتصال بقاعدة البيانات." } };
  const { data, error } = await supabase.from("payment_submissions")
    .select("id,status,receipt_path").eq("booking_id", bookingId).maybeSingle();
  return { data: (data as BookingPaymentSubmission | null) ?? null, error };
}
