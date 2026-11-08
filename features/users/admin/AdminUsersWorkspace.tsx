"use client";

import { RefreshCw } from "lucide-react";
import { useAdminUsers } from "./useAdminUsers";
import type { AdminUsersRole } from "./admin-users.types";

const fmt = (value: unknown) => value == null || value === "" ? "—" : String(value);

export default function AdminUsersWorkspace({
  role, searchTerm, onSearchTermChange,
}: { role: AdminUsersRole; searchTerm: string; onSearchTermChange: (value: string) => void }) {
  const {
    rows, eventOptions, userTotal, loading, error, message, updatingUserId,
    roleDrafts, setRoleDrafts, assignmentEventIds, setAssignmentEventIds, refresh, updateRole,
  } = useAdminUsers(role, searchTerm);
  const roleNames: Record<string,string> = {
    owner:"مالك المنصة", admin:"مشرف إداري", supervisor:"موظف حاضر",
    organizer:"منظم حاضر", gatekeeper:"منظم حاضر", advertiser:"مُعلن", customer:"عميل",
  };

  return <section className="admin-panel">
    <div className="admin-panel-head">
      <div><h3>المستخدمون والصلاحيات</h3><p>إدارة أدوار الحسابات وربط المنظم والمعلن بفعالياتهم</p></div>
      <div className="admin-panel-actions">
        <label className="admin-search-box"><span>بحث بالرقم أو البريد أو الهاتف</span><input type="search" value={searchTerm} onChange={event=>onSearchTermChange(event.target.value)} placeholder="رقم الهاتف أو البريد الإلكتروني"/></label>
        <span className="admin-user-total">عدد المستخدمين: {userTotal.toLocaleString("ar-SD-u-nu-latn")}</span>
        <button className="admin-refresh" type="button" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={16}/> تحديث</button>
      </div>
    </div>
    {error&&<div className="admin-notice" role="alert">{error}</div>}
    {message&&<div className="admin-notice" role="status">{message}</div>}
    {loading?<p className="admin-no-data">جاري تحميل المستخدمين...</p>:<div className="admin-users-table-wrap">
      <table className="admin-users-table">
        <thead><tr><th>الإسم</th><th>رقم الهاتف</th><th>الدور</th><th>تاريخ التسجيل</th><th>تعديل الدور / الفعالية</th></tr></thead>
        <tbody>{rows.map((row,index)=>{
          const draftRole=roleDrafts[row.id]||row.role||"customer";
          const selectedEvent=assignmentEventIds[row.id]??row.assignment_event_id??"";
          const protectedUser=row.role==="owner"||(role==="admin"&&row.role==="admin");
          return <tr key={row.id||index}>
            <td data-label="الإسم"><strong>{fmt(row.full_name)}</strong></td>
            <td data-label="رقم الهاتف"><span dir="ltr">{fmt(row.phone)}</span><small className="admin-user-email" dir="ltr">{fmt(row.email)}</small></td>
            <td data-label="الدور"><span className="admin-user-role">{roleNames[row.role]||fmt(row.role)}</span></td>
            <td data-label="تاريخ التسجيل">{row.created_at?new Date(row.created_at).toLocaleDateString("ar-SD-u-nu-latn"):"—"}</td>
            <td data-label="تعديل الدور / الفعالية">
              <div className="admin-user-role-editor">
                <select aria-label={"تعديل دور "+(row.full_name||"المستخدم")} value={draftRole} disabled={updatingUserId===row.id||protectedUser} onChange={event=>setRoleDrafts(current=>({...current,[row.id]:event.target.value}))}>
                  <option value="customer">عميل</option>
                  {(role==="owner"||row.role==="admin")&&<option value="admin">مشرف إداري</option>}
                  <option value="supervisor">موظف حاضر</option><option value="gatekeeper">منظم حاضر (بواب)</option><option value="advertiser">مُعلن</option>
                  {row.role==="organizer"&&<option value="organizer">منظم حاضر</option>}
                  {protectedUser&&<option value={row.role}>{roleNames[row.role]||row.role}</option>}
                </select>
                {(draftRole==="gatekeeper"||draftRole==="advertiser"||draftRole==="organizer")&&<select aria-label="اختيار الفعالية" value={selectedEvent} disabled={updatingUserId===row.id} onChange={event=>setAssignmentEventIds(current=>({...current,[row.id]:event.target.value}))}>
                  <option value="">اختر الفعالية (تشمل المسودات)</option>
                  {eventOptions.map(option=><option key={option.id} value={option.id}>{option.title} · {option.status==="draft"?"مسودة":option.status==="published"?"منشورة":option.status}</option>)}
                </select>}
                {!protectedUser&&<button type="button" className="admin-user-save-role" disabled={updatingUserId===row.id||draftRole==="organizer"||(draftRole==="admin"&&role!=="owner")||((draftRole==="gatekeeper"||draftRole==="advertiser")&&!selectedEvent)||draftRole===row.role&&((draftRole!=="gatekeeper"&&draftRole!=="advertiser")||selectedEvent===(row.assignment_event_id||""))} onClick={()=>void updateRole(row,draftRole,(draftRole==="gatekeeper"||draftRole==="advertiser")?selectedEvent:null)}>{updatingUserId===row.id?"جاري الحفظ…":"حفظ"}</button>}
              </div>
              {updatingUserId===row.id&&<small className="admin-user-saving">جاري الحفظ…</small>}
            </td>
          </tr>;
        })}</tbody>
      </table>
      {rows.length===0&&<p className="admin-no-data">لا يوجد مستخدمون مسجلون حتى الآن.</p>}
    </div>}
  </section>;
}
