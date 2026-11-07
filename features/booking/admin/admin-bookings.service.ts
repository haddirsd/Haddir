import { getSupabaseBrowserClient } from "../../../lib/supabase";
import type { AdminBookingRow, AdminBookingsResult } from "./admin-bookings.types";

export async function listAdminBookings(searchTerm = ""): Promise<AdminBookingsResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { rows: [], error: "تعذر الاتصال بقاعدة البيانات." };
  let query = supabase.from("bookings").select(
    "id,booking_number,customer_name,customer_email,customer_phone,event_id,subtotal,currency,status,expires_at,created_at,events(title,city,venue,starts_at),booking_items(quantity,unit_price,line_total,ticket_types(name)),payment_submissions(id,payment_account_name,payment_account_number,payment_account_beneficiary,transfer_reference,receipt_path,status,created_at)"
  ).order("created_at", { ascending: false }).limit(100);
  const term = searchTerm.trim().replace(/[(),]/g, " ").replace(/[%_]/g, "");
  if (term) query = query.or("booking_number.ilike.%"+term+"%,customer_email.ilike.%"+term+"%");
  const { data, error } = await query;
  if (error) return { rows: [], error: error.message || "تعذر تحميل الحجوزات." };

  const rows = await Promise.all((data || []).map(async (row: any) => {
    const paymentSubmissions = await Promise.all((row.payment_submissions || []).map(async (payment: any) => {
      if (!payment.receipt_path) return payment;
      const { data: signed } = await supabase.storage.from("payment-receipts").createSignedUrl(payment.receipt_path, 900);
      return { ...payment, receipt_url: signed?.signedUrl || null };
    }));
    return { ...row, payment_submissions: paymentSubmissions };
  }));
  return { rows: rows as AdminBookingRow[], error: null };
}
