"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { listAdminUsers, removeAdminUserEventAssignment, updateAdminUserRole as saveAdminUserRole } from "./admin-users.service";
import type { AdminUserEventOption, AdminUserRow, AdminUsersRole } from "./admin-users.types";

const EVENT_SCOPED_ROLES = ["supervisor", "gatekeeper", "advertiser"];

export function useAdminUsers(role: AdminUsersRole, searchTerm: string, roleFilter: string, page: number) {
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
    const result = await listAdminUsers(searchTerm, roleFilter, page, 25);
    if (requestId !== latestRequest.current) return;
    if (result.error) setError(result.error);
    else { setRows(result.rows); setEventOptions(result.eventOptions); setUserTotal(result.total); setError(""); }
    setLoading(false);
  }, [searchTerm, roleFilter, page]);

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
    if (role === "admin" && userRow.role === "admin") { setError("لا يحق للمشرف الإداري تغيير صلاحيات مشرف إداري آخر."); return; }
    if (nextRole === "admin" && role !== "owner") { setError("تعيين المشرف الإداري من صلاحيات مالك المنصة فقط."); return; }
    if (nextRole === "organizer") return;
    if (EVENT_SCOPED_ROLES.includes(nextRole) && !eventId) { setError("اختار الفعالية أولاً لهذا المستخدم."); return; }
    setUpdatingUserId(userRow.id); setError(""); setMessage("");
    try {
      const result = await saveAdminUserRole(userRow.id, nextRole, eventId);
      if (result.error) { setError(result.error); return; }
      const nextAssignments = EVENT_SCOPED_ROLES.includes(nextRole)
        ? (userRow.role === nextRole ? Array.from(new Set([...(userRow.assignment_event_ids || []), ...(eventId ? [eventId] : [])])) : (eventId ? [eventId] : []))
        : [];
      setRows(current => current.map(item => item.id === userRow.id
        ? { ...item, role: nextRole, assignment_event_ids: nextAssignments, assignment_event_id: nextAssignments[0] || "" }
        : item));
      setRoleDrafts(current => ({ ...current, [userRow.id]: nextRole }));
      setAssignmentEventIds(current => ({ ...current, [userRow.id]: "" }));
      setMessage(userRow.role === nextRole && EVENT_SCOPED_ROLES.includes(nextRole)
        ? "تمت إضافة الفعالية إلى تكليفات المستخدم."
        : "تم تحديث دور المستخدم بنجاح.");
      await refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "تعذر تعديل دور المستخدم.");
    } finally {
      setUpdatingUserId(null);
    }
  }, [role, updatingUserId, refresh]);

  const removeAssignment = useCallback(async (userRow: AdminUserRow, eventId: string) => {
    if (!["owner", "admin"].includes(role) || updatingUserId) return;
    if (role === "admin" && userRow.role === "admin") { setError("لا يحق للمشرف الإداري تعديل صلاحيات مشرف إداري آخر."); return; }
    setUpdatingUserId(userRow.id); setError(""); setMessage("");
    try {
      const result = await removeAdminUserEventAssignment(userRow.id, userRow.role, eventId);
      if (result.error) { setError(result.error); return; }
      setMessage("تم إلغاء تكليف الفعالية.");
      await refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "تعذر إلغاء التكليف.");
    } finally {
      setUpdatingUserId(null);
    }
  }, [role, updatingUserId, refresh]);

  return {
    rows, eventOptions, userTotal, loading, error, message, updatingUserId,
    roleDrafts, setRoleDrafts, assignmentEventIds, setAssignmentEventIds,
    refresh, updateRole, removeAssignment,
  };
}
