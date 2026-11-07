import { getSupabaseBrowserClient } from "../../../lib/supabase";
import type { AdminEventEditorData, AdminEventRow, AdminTicketForm, AdminEventAccountForm } from "./admin-events.types";

export async function listAdminEvents(): Promise<{ data: AdminEventRow[]; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: [], error: "تعذر الاتصال بقاعدة البيانات." };
  const { data, error } = await supabase.from("events")
    .select("id,title,category,city,venue,starts_at,status,created_at,is_trending,description,address,location_url,ends_at,cover_image_url,platform_fee_percent")
    .order("created_at", { ascending: false }).limit(100);
  return { data: (data || []) as AdminEventRow[], error: error?.message || null };
}

const toLocalInput = (value: string | null) => value
  ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  : "";

export async function getAdminEventEditorData(eventId: string): Promise<{ data: AdminEventEditorData | null; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: null, error: "تعذر الاتصال بقاعدة البيانات." };
  const [accountsResult, ticketsResult] = await Promise.all([
    supabase.from("event_payment_accounts").select("id,account_name,account_number,beneficiary,is_active,sort_order").eq("event_id", eventId).order("sort_order"),
    supabase.from("ticket_types").select("id,name,description,price,currency,quantity_total,quantity_sold,sales_start_at,sales_end_at,is_active").eq("event_id", eventId).order("created_at", { ascending: true }),
  ]);
  if (accountsResult.error) return { data: null, error: "تعذر تحميل حسابات الفعالية: " + accountsResult.error.message };
  if (ticketsResult.error) return { data: null, error: "تعذر تحميل أنواع التذاكر: " + ticketsResult.error.message };
  const paymentAccounts: AdminEventAccountForm[] = (accountsResult.data || []).map((account: any) => ({
    id: account.id, account_name: account.account_name, account_number: account.account_number,
    beneficiary: account.beneficiary || "", is_active: account.is_active, sort_order: account.sort_order,
  }));
  const tickets: AdminTicketForm[] = (ticketsResult.data || []).map((ticket: any) => ({
    id: ticket.id, name: ticket.name, description: ticket.description || "", price: String(ticket.price),
    currency: String(ticket.currency || "SDG").trim(), quantity_total: String(ticket.quantity_total),
    quantity_sold: Number(ticket.quantity_sold || 0), sales_start_at: toLocalInput(ticket.sales_start_at),
    sales_end_at: toLocalInput(ticket.sales_end_at), is_active: ticket.is_active !== false,
  }));
  return { data: { paymentAccounts, tickets }, error: null };
}

export async function deleteOrCancelAdminEvent(eventId: string): Promise<{ message: string; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { message: "", error: "تعذر الاتصال بقاعدة البيانات." };
  const [{ count: bookings, error: bookingsError }, { count: tickets, error: ticketsError }] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("event_id", eventId),
  ]);
  if (bookingsError || ticketsError) return { message: "", error: "تعذر التحقق من ارتباطات الفعالية قبل الحذف." };
  if ((bookings || 0) > 0 || (tickets || 0) > 0) {
    const { error } = await supabase.from("events").update({ status: "cancelled", is_trending: false }).eq("id", eventId);
    if (error) return { message: "", error: "تعذر إلغاء الفعالية: " + error.message };
    const { error: ticketError } = await supabase.from("ticket_types").update({ is_active: false }).eq("event_id", eventId);
    if (ticketError) return { message: "", error: "أُلغيت الفعالية لكن تعذر إيقاف أنواع التذاكر: " + ticketError.message };
    return { message: "الفعالية مرتبطة بحجوزات/تذاكر؛ ألغيناها وأخفيناها مع الاحتفاظ بالسجلات.", error: null };
  }
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  return error ? { message: "", error: "تعذر حذف الفعالية: " + error.message } : { message: "تم حذف الفعالية نهائياً.", error: null };
}

export async function publishDraftAdminEvent(eventId: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "تعذر الاتصال بقاعدة البيانات." };
  const { error } = await supabase.from("events").update({ status: "published" }).eq("id", eventId).eq("status", "draft");
  return { error: error?.message ? "تعذر نشر الفعالية: " + error.message : null };
}
