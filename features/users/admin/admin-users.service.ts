import { getSupabaseBrowserClient } from "../../../lib/supabase";
import type { AdminUserEventOption, AdminUserRow, AdminUsersResult } from "./admin-users.types";

const EVENT_SCOPED_ROLES = ["supervisor", "gatekeeper", "advertiser"];

export async function listAdminUsers(searchTerm: string, roleFilter = "all"): Promise<AdminUsersResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { rows: [], eventOptions: [], total: 0, error: "تعذر الاتصال بقاعدة البيانات." };
  const term = searchTerm.trim().replace(/[(),]/g, " ").replace(/[%_]/g, "");
  const [{ data: userRows, error: userError }, { count, error: countError }] = await Promise.all([
    supabase.rpc("admin_search_profiles", { p_query: term || null, p_limit: 200, p_offset: 0, p_role: roleFilter === "all" ? null : roleFilter }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);
  if (userError || countError) return { rows: [], eventOptions: [], total: count || 0, error: (userError || countError)?.message || "تعذر تحميل المستخدمين." };
  const [{ data: assignments, error: assignmentError }, { data: events, error: eventError }] = await Promise.all([
    supabase.from("event_role_assignments").select("user_id,event_id,assignment_role"),
    supabase.from("events").select("id,title,status").in("status", ["draft", "published"]).order("created_at", { ascending: false }).limit(200),
  ]);
  if (assignmentError || eventError) return { rows: [], eventOptions: [], total: count || 0, error: (assignmentError || eventError)?.message || "تعذر تحميل ربط الأدوار بالفعاليات." };
  const byUser = new Map<string, string[]>();
  for (const assignment of assignments || []) {
    const current = byUser.get(assignment.user_id) || [];
    if (!current.includes(assignment.event_id)) current.push(assignment.event_id);
    byUser.set(assignment.user_id, current);
  }
  return {
    rows: (userRows || []).map((user: any) => {
      const eventIds = EVENT_SCOPED_ROLES.includes(user.role) ? (byUser.get(user.id) || []) : [];
      return { ...user, assignment_event_ids: eventIds, assignment_event_id: eventIds[0] || "" };
    }) as AdminUserRow[],
    eventOptions: (events || []) as AdminUserEventOption[],
    total: count || 0,
    error: null,
  };
}

export async function updateAdminUserRole(
  userId: string, nextRole: string, eventId: string | null
): Promise<{ error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "تعذر الاتصال بقاعدة البيانات." };
  if (!["admin", "supervisor", "gatekeeper", "advertiser", "customer"].includes(nextRole))
    return { error: "الدور المحدد غير صالح." };
  if (EVENT_SCOPED_ROLES.includes(nextRole) && !eventId)
    return { error: "اختار الفعالية أولاً لهذا المستخدم." };
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id === userId) return { error: "لا يمكنك تغيير دور حسابك الحالي من هنا." };
  const { error } = await supabase.rpc("admin_update_profile_role", {
    p_user_id: userId, p_role: nextRole, p_event_id: eventId,
  });
  return { error: error?.message ? "تعذر تعديل دور المستخدم: " + error.message : null };
}

export async function removeAdminUserEventAssignment(
  userId: string, role: string, eventId: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "تعذر الاتصال بقاعدة البيانات." };
  const { error } = await supabase.rpc("admin_remove_event_role_assignment", {
    p_user_id: userId, p_role: role, p_event_id: eventId,
  });
  return { error: error?.message ? "تعذر إلغاء تكليف الفعالية: " + error.message : null };
}
