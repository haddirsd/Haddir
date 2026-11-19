import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import type { AdminPaymentDecision, AdminPaymentReviewResult, AdminPaymentRow } from "./admin-payments.types";
import { getAdminEventScope } from "./admin-event-scope";

const ADMIN_PAYMENTS_PAGE_SIZE = 100;

export async function listAdminPayments(page = 0): Promise<{ rows: AdminPaymentRow[]; totalCount: number; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { rows: [], error: "تعذر الاتصال بقاعدة البيانات." };
  const scope = await getAdminEventScope(supabase);
  if (scope.error) return { rows: [], error: scope.error };
  if (scope.eventIds !== null && scope.eventIds.length === 0) return { rows: [], totalCount: 0, error: null };
  const safePage = Math.max(0, Math.floor(page));
  const from = safePage * ADMIN_PAYMENTS_PAGE_SIZE;
  let query = supabase.from("payment_submissions").select(
    "id,booking_id,transfer_reference,receipt_path,amount,currency,status,review_note,created_at,payment_account_id,payment_account_name,payment_account_number,payment_account_beneficiary,bookings!inner(booking_number,customer_name,customer_email,customer_phone,subtotal,currency,events(title,city,venue,starts_at),booking_items(quantity,ticket_types(name)))",
    { count: "exact" }
  ).eq("status", "submitted").order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, from + ADMIN_PAYMENTS_PAGE_SIZE - 1);
  if (scope.eventIds !== null) query = query.in("bookings.event_id", scope.eventIds);
  const { data, error } = await query;
  if (error) return { rows: [], totalCount: 0, error: error.message || "تعذر تحميل إثباتات الدفع." };
  const rows = await Promise.all((data || []).map(async (row: any) => {
    if (!row.receipt_path) return { ...row, receipt_url: null };
    const { data: signed } = await supabase.storage.from("payment-receipts").createSignedUrl(row.receipt_path, 900);
    return { ...row, receipt_url: signed?.signedUrl || null };
  }));
  return { rows: rows as AdminPaymentRow[], totalCount: count ?? 0, error: null };
}

export async function reviewAdminPayment(
  submissionId: string, decision: AdminPaymentDecision, rejectionReason: string | null
): Promise<{ data: AdminPaymentReviewResult | null; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: null, error: "تعذر الاتصال بقاعدة البيانات." };
  const { data, error } = await supabase.rpc("review_payment_submission", {
    p_submission_id: submissionId, p_decision: decision, p_rejection_reason: rejectionReason,
  });
  if (error) return { data: null, error: error.message || "تعذرت مراجعة إثبات الدفع." };
  return { data: { bookingId: data?.booking_id || null, ticketsCreated: Number(data?.tickets_created || 0) }, error: null };
}
