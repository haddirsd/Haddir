import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import type { AdminReportData, AdminReportRow, AdminEventReportPage } from "./admin-reports.types";

const PAGE_SIZE = 50;
const EVENTS_PAGE_SIZE = 50;

export async function getAdminReportData(eventsPage: number): Promise<{ data: AdminReportData | null; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: null, error: "تعذر الاتصال بقاعدة البيانات." };
  const now = new Date().toISOString();
  const offset = (Math.max(1, eventsPage) - 1) * EVENTS_PAGE_SIZE;
  const [
    { data: events, count: eventTotal, error: eventsError },
    { data: summary, error: summaryError },
    { count: currentEvents, error: currentEventsError },
    { count: pastEvents, error: pastEventsError },
    { count: draftEvents, error: draftEventsError },
    { count: cancelledEvents, error: cancelledEventsError },
    { data: ticketTypes, error: ticketTypesError },
  ] = await Promise.all([
    supabase.from("events")
      .select("id,title,category,city,venue,address,description,location_url,cover_image_url,status,starts_at,ends_at,is_continuous,created_at,platform_fee_percent,ticket_types(id,name,description,price,currency,quantity_total,quantity_sold,is_active)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + EVENTS_PAGE_SIZE - 1),
    supabase.rpc("admin_get_report_summary"),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "published").or("ends_at.is.null,ends_at.gte." + now),
    supabase.from("events").select("id", { count: "exact", head: true }).or("status.eq.completed,ends_at.lt." + now),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "cancelled"),
    supabase.from("ticket_types").select("quantity_total,quantity_sold"),
  ]);
  const failure = eventsError || summaryError || currentEventsError || pastEventsError || draftEventsError || cancelledEventsError || ticketTypesError;
  if (failure) return { data: null, error: "تعذر تحميل الإحصائيات: " + failure.message };
  const totalCapacity = (ticketTypes || []).reduce((sum, row) => sum + (row.quantity_total == null ? 0 : Number(row.quantity_total)), 0);
  const soldCapacity = (ticketTypes || []).reduce((sum, row) => sum + Number(row.quantity_sold || 0), 0);
  return {
    data: {
      events: (events || []) as AdminReportRow[],
      eventTotal: eventTotal || 0,
      eventCounts: {
        current: currentEvents || 0,
        past: pastEvents || 0,
        draft: draftEvents || 0,
        cancelled: cancelledEvents || 0,
      },
      totalCapacity,
      remainingCapacity: Math.max(0, totalCapacity - soldCapacity),
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

export async function getAllEventReportRows(eventId: string): Promise<{ data: AdminEventReportPage; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: { bookings: [], tickets: [], bookingTotal: 0, ticketTotal: 0 }, error: "تعذر الاتصال بقاعدة البيانات." };
  if (!eventId) return { data: { bookings: [], tickets: [], bookingTotal: 0, ticketTotal: 0 }, error: "اختار الفعالية أولاً." };
  const fetchAll = async (table: "bookings" | "tickets", columns: string, sort: string) => {
    const all: AdminReportRow[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase.from(table).select(columns).eq("event_id", eventId).order(sort, { ascending: false }).range(offset, offset + 999);
      if (error) return { data: null as AdminReportRow[] | null, error };
      all.push(...((data || []) as AdminReportRow[]));
      if ((data || []).length < 1000) break;
      offset += 1000;
    }
    return { data: all, error: null };
  };
  const [bookings, tickets] = await Promise.all([
    fetchAll("bookings", "id,event_id,booking_number,user_id,customer_name,customer_email,customer_phone,subtotal,currency,status,created_at,booking_items(id,ticket_type_id,quantity,unit_price,line_total,ticket_types(name,currency))", "created_at"),
    fetchAll("tickets", "id,event_id,ticket_type_id,ticket_code,attendee_name,status,issued_at,used_at", "issued_at"),
  ]);
  const failure = bookings.error || tickets.error;
  if (failure) return { data: { bookings: [], tickets: [], bookingTotal: 0, ticketTotal: 0 }, error: "تعذر تجهيز التقرير الكامل: " + failure.message };
  return { data: { bookings: bookings.data || [], tickets: tickets.data || [], bookingTotal: bookings.data?.length || 0, ticketTotal: tickets.data?.length || 0 }, error: null };
}
