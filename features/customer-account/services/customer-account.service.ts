import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import type { CustomerNotification, CustomerTicket } from "../types";

export const CUSTOMER_TICKETS_PAGE_SIZE = 25;

export async function loadCustomerAccountData(
  userId: string,
  ticketStatus: "valid" | "used",
  ticketPage: number,
): Promise<{
  tickets: CustomerTicket[];
  ticketCounts: { valid: number; used: number };
  notifications: CustomerNotification[];
  error: string | null;
}> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { tickets: [], ticketCounts: { valid: 0, used: 0 }, notifications: [], error: "تعذر الاتصال بقاعدة البيانات." };

  const offset = (ticketPage - 1) * CUSTOMER_TICKETS_PAGE_SIZE;
  const otherStatus = ticketStatus === "valid" ? "used" : "valid";
  const [ticketsResult, otherCountResult, notificationsResult] = await Promise.all([
    supabase.from("tickets")
      .select("id,booking_item_id,ticket_code,status,issued_at,events(title,starts_at,is_continuous,venue,cover_image_url),ticket_types(name),bookings!inner(booking_number,user_id),booking_items(quantity)", { count: "exact" })
      .eq("bookings.user_id", userId)
      .eq("status", ticketStatus)
      .order("issued_at", { ascending: false })
      .range(offset, offset + CUSTOMER_TICKETS_PAGE_SIZE - 1),
    supabase.from("tickets")
      .select("id,bookings!inner(user_id)", { count: "exact", head: true })
      .eq("bookings.user_id", userId)
      .eq("status", otherStatus),
    supabase.from("notifications")
      .select("id,title,message,type,is_read,created_at,booking_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const failure = ticketsResult.error || otherCountResult.error || notificationsResult.error;
  const currentCount = ticketsResult.count || 0;
  const otherCount = otherCountResult.count || 0;
  return {
    tickets: (ticketsResult.data || []) as CustomerTicket[],
    ticketCounts: ticketStatus === "valid"
      ? { valid: currentCount, used: otherCount }
      : { valid: otherCount, used: currentCount },
    notifications: (notificationsResult.data || []) as CustomerNotification[],
    error: failure?.message || null,
  };
}

export async function markCustomerNotificationRead(userId: string, notificationId: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "تعذر الاتصال بقاعدة البيانات." };
  const { error } = await supabase.from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", userId);
  return { error: error?.message || null };
}

export async function markAllCustomerNotificationsRead(userId: string, notificationIds: string[]): Promise<{ error: string | null }> {
  if (!notificationIds.length) return { error: null };
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "تعذر الاتصال بقاعدة البيانات." };
  const { error } = await supabase.from("notifications")
    .update({ is_read: true })
    .in("id", notificationIds)
    .eq("user_id", userId);
  return { error: error?.message || null };
}

export async function requestCustomerAccountDeletion(confirmedEmail: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "تعذر الاتصال بالخدمة حالياً." };
  const { data, error } = await supabase.functions.invoke("delete-customer-account", {
    body: { confirm_email: confirmedEmail },
  });
  if (error || !data?.success) {
    let failureMessage = data?.error;
    try {
      if (!failureMessage && error) failureMessage = (await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.())?.error;
    } catch {}
    return { error: failureMessage || "تعذر حذف الحساب حالياً. لم نتمكن من تأكيد اكتمال العملية." };
  }
  return { error: null };
}
