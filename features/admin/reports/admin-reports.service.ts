import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import type { AdminReportData, AdminReportRow, AdminEventReportPage } from "./admin-reports.types";

const PAGE_SIZE = 50;

export async function getAdminReportData(): Promise<{ data: AdminReportData | null; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: null, error: "تعذر الاتصال بقاعدة البيانات." };
  const [{ data: events, error: eventsError }, { data: summary, error: summaryError }] = await Promise.all([
    supabase.from("events")
      .select("id,title,category,city,venue,address,description,location_url,cover_image_url,status,starts_at,ends_at,is_continuous,created_at,platform_fee_percent,ticket_types(id,name,description,price,currency,quantity_total,quantity_sold,is_active)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.rpc("admin_get_report_summary"),
  ]);
  if (eventsError || summaryError) return { data: null, error: "تعذر تحميل الإحصائيات: " + (eventsError || summaryError)?.message };
  return {
    data: {
      events: (events || []) as AdminReportRow[],
      profiles: summary?.profiles || {},
      bookings: summary?.bookings || {},
      tickets: summary?.tickets || {},
      eventMetrics: summary?.event_metrics || [],
    },
    error: null,
  };
}

export async function getAdminEventReportPage(
  eventId: string,
  bookingsPage: number,
  ticketsPage: number
): Promise<{ data: AdminEventReportPage; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: { bookings: [], tickets: [], bookingTotal: 0, ticketTotal: 0 }, error: "تعذر الاتصال بقاعدة البيانات." };
  if (!eventId) return { data: { bookings: [], tickets: [], bookingTotal: 0, ticketTotal: 0 }, error: null };
  const bookingOffset = (Math.max(1, bookingsPage) - 1) * PAGE_SIZE;
  const ticketOffset = (Math.max(1, ticketsPage) - 1) * PAGE_SIZE;
  const [{ data: bookings, count: bookingTotal, error: bookingError }, { data: tickets, count: ticketTotal, error: ticketError }] = await Promise.all([
    supabase.from("bookings")
      .select("id,event_id,booking_number,user_id,customer_name,customer_email,customer_phone,subtotal,currency,status,created_at,booking_items(id,ticket_type_id,quantity,unit_price,line_total,ticket_types(name,currency))", { count: "exact" })
      .eq("event_id", eventId).order("created_at", { ascending: false }).range(bookingOffset, bookingOffset + PAGE_SIZE - 1),
    supabase.from("tickets")
      .select("id,event_id,ticket_type_id,ticket_code,attendee_name,status,issued_at,used_at", { count: "exact" })
      .eq("event_id", eventId).order("issued_at", { ascending: false }).range(ticketOffset, ticketOffset + PAGE_SIZE - 1),
  ]);
  const failure = bookingError || ticketError;
  if (failure) return { data: { bookings: [], tickets: [], bookingTotal: 0, ticketTotal: 0 }, error: "تعذر تحميل سجلات الفعالية: " + failure.message };
  return {
    data: {
      bookings: (bookings || []) as AdminReportRow[],
      tickets: (tickets || []) as AdminReportRow[],
      bookingTotal: bookingTotal || 0,
      ticketTotal: ticketTotal || 0,
    },
    error: null,
  };
}
