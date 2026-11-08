import { getSupabaseBrowserClient } from "../../../lib/supabase";
import type { AdminPaymentDecision, AdminPaymentReviewResult, AdminPaymentRow } from "./admin-payments.types";

export async function listAdminPayments(): Promise<{ rows: AdminPaymentRow[]; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { rows: [], error: "تعذر الاتصال بقاعدة البيانات." };
  const { data, error } = await supabase.from("payment_submissions").select(
    "id,booking_id,transfer_reference,receipt_path,amount,currency,status,review_note,created_at,payment_account_id,payment_account_name,payment_account_number,payment_account_beneficiary,bookings(booking_number,customer_name,customer_email,customer_phone,subtotal,currency,events(title,city,venue,starts_at),booking_items(quantity,ticket_types(name)))"
  ).eq("status", "submitted").order("created_at", { ascending: false }).limit(100);
  if (error) return { rows: [], error: error.message || "تعذر تحميل إثباتات الدفع." };
  const rows = await Promise.all((data || []).map(async (row: any) => {
    if (!row.receipt_path) return { ...row, receipt_url: null };
    const { data: signed } = await supabase.storage.from("payment-receipts").createSignedUrl(row.receipt_path, 900);
    return { ...row, receipt_url: signed?.signedUrl || null };
  }));
  return { rows: rows as AdminPaymentRow[], error: null };
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
