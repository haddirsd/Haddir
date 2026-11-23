import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import type { AdminActivityRow } from "./admin-activity.types";

export type AdminActivityFilters = {
  search: string;
  role: string;
  group: string;
  period: string;
};

export async function listAdminActivity(
  page: number,
  pageSize: number,
  filters: AdminActivityFilters,
): Promise<{ rows: AdminActivityRow[]; total: number; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { rows: [], total: 0, error: "تعذر الاتصال بقاعدة البيانات." };
  const offset = (Math.max(1, page) - 1) * pageSize;
  let query = supabase.from("admin_activity_log")
    .select("id,actor_name,actor_role,action,entity_type,entity_label,event_id,booking_id,details,created_at,events(title)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (filters.role !== "all") query = query.eq("actor_role", filters.role);
  if (filters.group !== "all") query = query.ilike("action", filters.group + ".%");
  if (filters.period !== "all") {
    const cutoff = new Date();
    if (filters.period === "today") cutoff.setHours(0, 0, 0, 0);
    else cutoff.setTime(Date.now() - (filters.period === "7d" ? 7 : 30) * 86400000);
    query = query.gte("created_at", cutoff.toISOString());
  }
  const term = filters.search.trim().replace(/[,%_()]/g, " ").replace(/\s+/g, " ");
  if (term) {
    const pattern = "%" + term + "%";
    query = query.or([
      "actor_name.ilike." + pattern,
      "actor_role.ilike." + pattern,
      "action.ilike." + pattern,
      "entity_label.ilike." + pattern,
      "entity_type.ilike." + pattern,
    ].join(","));
  }

  const { data, count, error } = await query;
  return {
    rows: (data || []) as AdminActivityRow[],
    total: count || 0,
    error: error?.message || null,
  };
}
