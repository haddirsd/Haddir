import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import type { AdminBookingRow, AdminBookingsResult } from "./admin-bookings.types";
import { getAdminEventScope } from "./admin-event-scope";

const ADMIN_BOOKINGS_PAGE_SIZE = 100;

export async function listAdminBookings(searchTerm = "", page = 0): Promise<AdminBookingsResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { rows: [], totalCount: 0, error: "تعذر الاتصال بقاعدة البيانات." };
  const scope = await getAdminEventScope(supabase);
  if (scope.error) return { rows: [], totalCount: 0, error: scope.error };
  if (scope.eventIds !== null && scope.eventIds.length === 0) return { rows: [], totalCount: 0, error: null };
  const safePage = Math.max(0, Math.floor(page));
  const from = safePage * ADMIN_BOOKINGS_PAGE_SIZE;
  let query = supabase.from("bookings").select(
    "id,booking_number,customer_name,customer_email,customer_phone,event_id,subtotal,currency,status,expires_at,created_at,events(title,city,venue,starts_at),booking_items(quantity,unit_price,line_total,ticket_types(name)),payment_submissions(id,payment_account_name,payment_account_number,payment_account_beneficiary,transfer_reference,receipt_path,status,created_at)",
    { count: "exact" }
  ).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, from + ADMIN_BOOKINGS_PAGE_SIZE - 1);
  const term = searchTerm.trim().replace(/[(),]/g, " ").replace(/[%_]/g, "");
  if (scope.eventIds !== null) query = query.in("event_id", scope.eventIds);
  if (term) query = query.or("booking_number.ilike.%"+term+"%,customer_email.ilike.%"+term+"%");
  const { data, count, error } = await query;
  if (error) return { rows: [], totalCount: 0, error: error.message || "تعذر تحميل الحجوزات." };

  const receiptPaths = Array.from(new Set(
    (data || []).flatMap((row: any) =>
      (row.payment_submissions || [])
        .map((payment: any) => payment.receipt_path)
        .filter((path: unknown): path is string => typeof path === "string" && path.length > 0)
    )
  ));
  const { data: signedFiles } = receiptPaths.length
    ? await supabase.storage.from("payment-receipts").createSignedUrls(receiptPaths, 900)
    : { data: [] };
  const receiptUrls = new Map(
    (signedFiles || []).flatMap((file) =>
      file.path && file.signedUrl && !file.error ? [[file.path, file.signedUrl] as const] : []
    )
  );
  const rows = (data || []).map((row: any) => ({
    ...row,
    payment_submissions: (row.payment_submissions || []).map((payment: any) => ({
      ...payment,
      receipt_url: payment.receipt_path ? receiptUrls.get(payment.receipt_path) || null : null,
    })),
  }));
  return { rows: rows as AdminBookingRow[], totalCount: count ?? 0, error: null };
}
