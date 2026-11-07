import { getSupabaseBrowserClient } from "../../../lib/supabase";
import type { AdminActivityRow } from "./admin-activity.types";

export async function listAdminActivity(): Promise<{ rows: AdminActivityRow[]; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { rows: [], error: "تعذر الاتصال بقاعدة البيانات." };
  const { data, error } = await supabase.from("admin_activity_log")
    .select("id,actor_name,actor_role,action,entity_type,entity_label,event_id,booking_id,details,created_at,events(title)")
    .order("created_at", { ascending: false }).limit(500);
  return { rows: (data || []) as AdminActivityRow[], error: error?.message || null };
}
