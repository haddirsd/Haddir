import { getSupabaseBrowserClient } from "../../../lib/supabase";
import type { AdminOverviewRole, AdminOverviewStats } from "./admin-overview.types";

export async function getAdminOverviewStats(role: AdminOverviewRole): Promise<{ data: AdminOverviewStats | null; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: null, error: "تعذر الاتصال بقاعدة البيانات." };
  const [events, bookings, pending, users, confirmed] = await Promise.all([
    role === "supervisor" ? Promise.resolve({ count: null, error: null }) : supabase.from("events").select("id", { count: "exact", head: true }),
    supabase.from("bookings").select("id", { count: "exact", head: true }),
    supabase.from("payment_submissions").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    role === "owner" || role === "admin" ? supabase.from("profiles").select("id", { count: "exact", head: true }) : Promise.resolve({ count: null, error: null }),
    role === "supervisor" ? Promise.resolve({ data: [], error: null }) : supabase.from("bookings").select("subtotal").eq("status", "confirmed"),
  ]);
  const failed = [events, bookings, pending, users, confirmed].some(result => result.error);
  if (failed) return { data: null, error: "تعذر تحميل بعض مؤشرات الإدارة. تحقق من سياسات قاعدة البيانات." };
  return {
    data: {
      events: events.count || 0, bookings: bookings.count || 0, pending: pending.count || 0,
      users: users.count || 0, confirmed: confirmed.data?.length || 0,
      revenue: (confirmed.data || []).reduce((sum: number, row: any) => sum + Number(row.subtotal || 0), 0),
    },
    error: null,
  };
}
