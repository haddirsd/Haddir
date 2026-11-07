"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase";
import { listAdminUsers, updateAdminUserRole as saveAdminUserRole } from "./admin-users.service";
import type { AdminUserEventOption, AdminUserRow, AdminUsersRole } from "./admin-users.types";

export function useAdminUsers(role: AdminUsersRole, searchTerm: string) {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [eventOptions, setEventOptions] = useState<AdminUserEventOption[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string,string>>({});
  const [assignmentEventIds, setAssignmentEventIds] = useState<Record<string,string>>({});
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    const result = await listAdminUsers(searchTerm);
    if (requestId !== latestRequest.current) return;
    if (result.error) setError(result.error);
    else { setRows(result.rows); setEventOptions(result.eventOptions); setUserTotal(result.total); setError(""); }
    setLoading(false);
  }, [searchTerm]);

  useEffect(() => {
    void refresh();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase.channel("admin-users-workspace")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "event_role_assignments" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => void refresh())
      .subscribe();
    return () => { latestRequest.current += 1; void supabase.removeChannel(channel); };
  }, [refresh]);

  const updateRole = useCallback(async (userRow: AdminUserRow, nextRole: string, eventId: string | null) => {
    if (!["owner", "admin"].includes(role) || updatingUserId) return;
    if (userRow.role === "owner") { setError("لا يمكن تغيير صلاحية مالك المنصة."); return; }
    if (nextRole === "organizer") return;
    if ((nextRole === "gatekeeper" || nextRole === "advertiser") && !eventId) { setError("اختار الفعالية أولاً لهذا المستخدم."); return; }
    if (!window.confirm("تأكيد تغيير دور " + (userRow.full_name || "هذا المستخدم") + "؟")) return;
    setUpdatingUserId(userRow.id); setError(""); setMessage("");
    try {
      const result = await saveAdminUserRole(userRow.id, nextRole, eventId);
      if (result.error) { setError(result.error); return; }
      setRows(current => current.map(item => item.id === userRow.id ? { ...item, role: nextRole, assignment_event_id: eventId || "" } : item));
      setRoleDrafts(current => ({ ...current, [userRow.id]: nextRole }));
      setAssignmentEventIds(current => ({ ...current, [userRow.id]: eventId || "" }));
      setMessage("تم تحديث دور المستخدم بنجاح.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "تعذر تعديل دور المستخدم.");
    } finally {
      setUpdatingUserId(null);
    }
  }, [role, updatingUserId]);

  return {
    rows, eventOptions, userTotal, loading, error, message, updatingUserId,
    roleDrafts, setRoleDrafts, assignmentEventIds, setAssignmentEventIds,
    refresh, updateRole,
  };
}
