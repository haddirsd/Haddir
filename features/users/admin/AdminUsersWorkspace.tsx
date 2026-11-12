"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { HaddirDialog } from "../../../components/ui/HaddirDialog";
import { HaddirSelect } from "../../../components/ui/HaddirSelect";
import { useAdminUsers } from "./useAdminUsers";
import type { AdminUserRow, AdminUsersRole } from "./admin-users.types";

const fmt = (value: unknown) => value == null || value === "" ? "—" : String(value);

export default function AdminUsersWorkspace({
  role, searchTerm, onSearchTermChange,
}: { role: AdminUsersRole; searchTerm: string; onSearchTermChange: (value: string) => void }) {
  const [roleFilter, setRoleFilter] = useState("all");
  const [pendingRole,setPendingRole]=useState<{row:AdminUserRow;nextRole:string;eventId:string|null}|null>(null);
  const {
    rows, eventOptions, userTotal, loading, error, message, updatingUserId,
    roleDrafts, setRoleDrafts, assignmentEventIds, setAssignmentEventIds, refresh, updateRole,
  } = useAdminUsers(role, searchTerm, roleFilter);
  const roleNames: Record<string,string> = {
    owner:"مالك المنصة", admin:"مشرف إداري", supervisor:"موظف حاضر",
    organizer:"منظم حاضر", gatekeeper:"منظم حاضر", advertiser:"مُعلن", customer:"عميل",
  };

  return <section className="admin-panel">
    <div className="admin-panel-head">
      <div><h3>المستخدمون والصلاحيات</h3><p>إدارة أدوار الحسابات وربط المنظم والمعلن بفعالياتهم</p></div>
      <div className="admin-panel-actions">
        <label className="admin-search-box"><span>بحث بالرقم أو البريد أو الهاتف</span><input type="search" value={searchTerm} onChange={event=>onSearchTermChange(event.target.value)} placeholder="رقم الهاتف أو البريد الإلكتروني"/></label>
        <label className="admin-search-box"><span>تصفية حسب الدور</span><HaddirSelect value={roleFilter} onChange={setRoleFilter} ariaLabel="تصفية حسب الدور" options={[{value:"all",label:"كل الأدوار"},{value:"customer",label:"العملاء"},{value:"supervisor",label:"موظفو حاضر"},{value:"gatekeeper",label:"البوابون"},{value:"organizer",label:"المنظمون"},{value:"advertiser",label:"المعلنون"},{value:"admin",label:"المشرفون الإداريون"},{value:"owner",label:"مالك المنصة"}]}/></label>
        <span className="admin-user-total">عدد النتائج: {rows.length.toLocaleString("ar-SD-u-nu-latn")} من {userTotal.toLocaleString("ar-SD-u-nu-latn")}</span>
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
                <HaddirSelect ariaLabel={"تعديل دور "+(row.full_name||"المستخدم")} value={draftRole} disabled={updatingUserId===row.id||protectedUser} onChange={value=>setRoleDrafts(current=>({...current,[row.id]:value}))} options={[
                  {value:"customer",label:"عميل"},
                  ...((role==="owner"||row.role==="admin")?[{value:"admin",label:"مشرف إداري"}]:[]),
                  {value:"supervisor",label:"موظف حاضر"},{value:"gatekeeper",label:"منظم حاضر (بواب)"},{value:"advertiser",label:"مُعلن"},
                  ...(row.role==="organizer"?[{value:"organizer",label:"منظم حاضر"}]:[]),
                  ...(protectedUser?[{value:row.role,label:roleNames[row.role]||row.role}]:[])
                ]}/>
                {(draftRole==="gatekeeper"||draftRole==="advertiser"||draftRole==="organizer")&&<HaddirSelect ariaLabel="اختيار الفعالية" value={selectedEvent} disabled={updatingUserId===row.id} placeholder="اختر الفعالية (تشمل المسودات)" onChange={value=>setAssignmentEventIds(current=>({...current,[row.id]:value}))} options={[{value:"",label:"اختر الفعالية (تشمل المسودات)"},...eventOptions.map(option=>({value:option.id,label:option.title+" · "+(option.status==="draft"?"مسودة":option.status==="published"?"منشورة":option.status)}))]}/>}
                {!protectedUser&&<button type="button" className="admin-user-save-role" disabled={updatingUserId===row.id||draftRole==="organizer"||(draftRole==="admin"&&role!=="owner")||((draftRole==="gatekeeper"||draftRole==="advertiser")&&!selectedEvent)||draftRole===row.role&&((draftRole!=="gatekeeper"&&draftRole!=="advertiser")||selectedEvent===(row.assignment_event_id||""))} onClick={()=>setPendingRole({row,nextRole:draftRole,eventId:(draftRole==="gatekeeper"||draftRole==="advertiser")?selectedEvent:null})}>{updatingUserId===row.id?"جاري الحفظ…":"حفظ"}</button>}
              </div>
              {updatingUserId===row.id&&<small className="admin-user-saving">جاري الحفظ…</small>}
            </td>
          </tr>;
        })}</tbody>
      </table>
      {rows.length===0&&<p className="admin-no-data">لا يوجد مستخدمون مسجلون حتى الآن.</p>}
    </div>}
    {pendingRole&&<HaddirDialog open title="تأكيد تغيير الصلاحية؟" description={"سيتم تغيير دور "+(pendingRole.row.full_name||"هذا المستخدم")+" إلى "+(roleNames[pendingRole.nextRole]||pendingRole.nextRole)+"."} confirmLabel="حفظ الصلاحية" onCancel={()=>setPendingRole(null)} onConfirm={async()=>{const target=pendingRole;setPendingRole(null);await updateRole(target.row,target.nextRole,target.eventId);}}/>}
  </section>;
}
