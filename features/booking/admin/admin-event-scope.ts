import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminEventScope = {
  eventIds: string[] | null;
  error: string | null;
};

/**
 * Managers have platform-wide access. Event supervisors are restricted to
 * their explicitly assigned events. Unknown roles and lookup failures fail closed.
 */
export async function getAdminEventScope(
  supabase: SupabaseClient
): Promise<AdminEventScope> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { eventIds: [], error: "تعذر التحقق من حساب المستخدم." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { eventIds: [], error: "تعذر التحقق من صلاحيات المستخدم." };
  }

  if (profile.role === "owner" || profile.role === "admin") {
    return { eventIds: null, error: null };
  }

  if (profile.role !== "supervisor") {
    return { eventIds: [], error: null };
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from("event_role_assignments")
    .select("event_id")
    .eq("user_id", user.id)
    .eq("assignment_role", "supervisor");

  if (assignmentError) {
    return { eventIds: [], error: "تعذر تحميل الفعاليات المسندة إلى المشرف." };
  }

  return {
    eventIds: [...new Set((assignments || []).map((assignment) => assignment.event_id))],
    error: null,
  };
}
