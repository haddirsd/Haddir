import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import type { CustomerNotification, CustomerTicket } from "../types";

export async function loadCustomerAccountData(userId: string): Promise<{
  tickets: CustomerTicket[];
  notifications: CustomerNotification[];
  error: string | null;
}> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { tickets: [], notifications: [], error: "تعذر الاتصال بقاعدة البيانات." };

  const [ticketsResult, notificationsResult] = await Promise.all([
    supabase.from("tickets")
      .select("id,booking_item_id,ticket_code,status,issued_at,events(title,starts_at,is_continuous,venue,cover_image_url),ticket_types(name),bookings!inner(booking_number,user_id),booking_items(quantity)")
      .eq("bookings.user_id", userId)
      .order("issued_at", { ascending: false }),
    supabase.from("notifications")
      .select("id,title,message,type,is_read,created_at,booking_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const failure = ticketsResult.error || notificationsResult.error;
  return {
    tickets: (ticketsResult.data || []) as CustomerTicket[],
    notifications: (notificationsResult.data || []) as CustomerNotification[],
    error: failure?.message || null,
  };
}
