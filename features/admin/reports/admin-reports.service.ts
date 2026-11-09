import { getSupabaseBrowserClient } from "../../../lib/supabase";
import type { AdminReportData, AdminReportRow } from "./admin-reports.types";

async function fetchAll(table: string, columns: string, sort: string): Promise<{ data: AdminReportRow[] | null; error: any }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: null, error: { message: "تعذر الاتصال بقاعدة البيانات." } };
  const all: AdminReportRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(columns).order(sort, { ascending: false }).range(offset, offset + 999);
    if (error) return { data: null, error };
    all.push(...((data || []) as AdminReportRow[]));
    if ((data || []).length < 1000) break;
    offset += 1000;
  }
  return { data: all, error: null };
}

export async function getAdminReportData(): Promise<{ data: AdminReportData | null; error: string | null }> {
  const [events, profiles, bookings, tickets] = await Promise.all([
    fetchAll("events", "id,title,status,starts_at,ends_at,platform_fee_percent,ticket_types(id,name,price,currency,quantity_total,quantity_sold)", "created_at"),
    fetchAll("profiles", "id,role", "created_at"),
    fetchAll("bookings", "id,event_id,booking_number,user_id,customer_email,customer_phone,subtotal,currency,status,created_at,booking_items(id,ticket_type_id,quantity,unit_price,line_total,ticket_types(name,currency))", "created_at"),
    fetchAll("tickets", "id,event_id,ticket_type_id,status", "issued_at"),
  ]);
  const failure = events.error || profiles.error || bookings.error || tickets.error;
  if (failure) return { data: null, error: "تعذر تحميل الإحصائيات: " + failure.message };
  return { data: { events: events.data || [], profiles: profiles.data || [], bookings: bookings.data || [], tickets: tickets.data || [] }, error: null };
}
