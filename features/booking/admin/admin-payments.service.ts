import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import type { AdminPaymentDecision, AdminPaymentReviewResult, AdminPaymentRow } from "./admin-payments.types";
import { getAdminEventScope } from "./admin-event-scope";

const ADMIN_PAYMENTS_PAGE_SIZE = 100;

export async function listAdminPayments(page = 0, eventId: string | null = null): Promise<{ rows: AdminPaymentRow[]; totalCount: number; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { rows: [], totalCount: 0, error: "تعذر الاتصال بقاعدة البيانات." };
  const scope = await getAdminEventScope(supabase);
  if (scope.error) return { rows: [], totalCount: 0, error: scope.error };
  if (scope.eventIds !== null && scope.eventIds.length === 0) return { rows: [], totalCount: 0, error: null };
  const safePage = Math.max(0, Math.floor(page));
  const from = safePage * ADMIN_PAYMENTS_PAGE_SIZE;
  let query = supabase.from("payment_submissions").select(
    "id,booking_id,transfer_reference,receipt_path,amount,currency,status,review_note,created_at,payment_account_id,payment_account_name,payment_account_number,payment_account_beneficiary,bookings!inner(booking_number,customer_name,customer_email,customer_phone,subtotal,currency,events(title,city,venue,starts_at),booking_items(quantity,ticket_types(name)))",
    { count: "exact" }
  ).eq("status", "submitted").order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, from + ADMIN_PAYMENTS_PAGE_SIZE - 1);
  if (scope.eventIds !== null) query = query.in("bookings.event_id", scope.eventIds);
  if (eventId) query = query.eq("bookings.event_id", eventId);
  const { data, count, error } = await query;
  if (error) return { rows: [], totalCount: 0, error: error.message || "تعذر تحميل إثباتات الدفع." };
  const receiptPaths = Array.from(new Set(
    (data || [])
      .map((row: any) => row.receipt_path)
      .filter((path: unknown): path is string => typeof path === "string" && path.length > 0)
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
    receipt_url: row.receipt_path ? receiptUrls.get(row.receipt_path) || null : null,
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


export type AdminPaymentEventFilter = { id: string; title: string; pendingCount: number };

export async function listAdminPaymentEvents(): Promise<{ events: AdminPaymentEventFilter[]; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { events: [], error: "تعذر الاتصال بقاعدة البيانات." };
  const scope = await getAdminEventScope(supabase);
  if (scope.error) return { events: [], error: scope.error };
  if (scope.eventIds !== null && scope.eventIds.length === 0) return { events: [], error: null };

  let eventsQuery = supabase.from("events").select("id,title").order("title", { ascending: true });
  let pendingQuery = supabase.from("payment_submissions")
    .select("id,bookings!inner(event_id)")
    .eq("status", "submitted");
  if (scope.eventIds !== null) {
    eventsQuery = eventsQuery.in("id", scope.eventIds);
    pendingQuery = pendingQuery.in("bookings.event_id", scope.eventIds);
  }

  const [{ data: eventRows, error: eventsError }, { data: pendingRows, error: pendingError }] = await Promise.all([
    eventsQuery,
    pendingQuery,
  ]);
  if (eventsError) return { events: [], error: eventsError.message || "تعذر تحميل قائمة الفعاليات." };
  if (pendingError) return { events: [], error: pendingError.message || "تعذر تحميل أعداد الحجوزات المعلقة." };

  const counts = new Map<string, number>();
  for (const row of pendingRows || []) {
    const booking = Array.isArray((row as any).bookings) ? (row as any).bookings[0] : (row as any).bookings;
    const id = booking?.event_id;
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  }
  return {
    events: (eventRows || []).map((event: any) => ({
      id: event.id,
      title: event.title || "فعالية بدون اسم",
      pendingCount: counts.get(event.id) || 0,
    })),
    error: null,
  };
}
