"use client";

import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { HaddirDialog } from "../../../components/ui/HaddirDialog";
import { HaddirSelect } from "../../../components/ui/HaddirSelect";
import { useAdminUsers } from "./useAdminUsers";
import type { AdminUserRow, AdminUsersRole } from "./admin-users.types";

const fmt = (value: unknown) => value == null || value === "" ? "—" : String(value);
const EVENT_SCOPED_ROLES = ["supervisor", "gatekeeper", "advertiser"];

export default function AdminUsersWorkspace({
  role, searchTerm, onSearchTermChange,
}: { role: AdminUsersRole; searchTerm: string; onSearchTermChange: (value: string) => void }) {
  const [roleFilter, setRoleFilter] = useState("all");
  const [pendingRole,setPendingRole]=useState<{row:AdminUserRow;nextRole:string;eventId:string|null}|null>(null);
  const {
    rows, eventOptions, userTotal, loading, error, message, updatingUserId,
    roleDrafts, setRoleDrafts, assignmentEventIds, setAssignmentEventIds, refresh, updateRole, removeAssignment,
  } = useAdminUsers(role, searchTerm, roleFilter);
  const roleNames: Record<string,string> = {
    owner:"مالك المنصة", admin:"مشرف إداري", supervisor:"مشرف فعالية",
    organizer:"منظم حاضر", gatekeeper:"منظم حاضر (بواب)", advertiser:"مُعلن", customer:"عميل",
  };
  const eventName = (id:string) => eventOptions.find(option=>option.id===id)?.title || "فعالية";

  return <section className="admin-panel">
    <div className="admin-panel-head">
      <div><h3>المستخدمون والصلاحيات</h3><p>إدارة أدوار الحسابات وربط المشرف والبوّاب والمعلن بفعاليات محددة</p></div>
      <div className="admin-panel-actions">
        <label className="admin-search-box"><span>بحث بالرقم أو البريد أو الهاتف</span><input type="search" value={searchTerm} onChange={event=>onSearchTermChange(event.target.value)} placeholder="رقم الهاتف أو البريد الإلكتروني"/></label>
        <label className="admin-search-box"><span>تصفية حسب الدور</span><HaddirSelect value={roleFilter} onChange={setRoleFilter} ariaLabel="تصفية حسب الدور" options={[{value:"all",label:"كل الأدوار"},{value:"customer",label:"العملاء"},{value:"supervisor",label:"مشرفو الفعاليات"},{value:"gatekeeper",label:"البوابون"},{value:"organizer",label:"المنظمون"},{value:"advertiser",label:"المعلنون"},{value:"admin",label:"المشرفون الإداريون"},{value:"owner",label:"مالك المنصة"}]}/></label>
        <span className="admin-user-total">عدد النتائج: {rows.length.toLocaleString("ar-SD-u-nu-latn")} من {userTotal.toLocaleString("ar-SD-u-nu-latn")}</span>
        <button className="admin-refresh" type="button" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={16}/> تحديث</button>
      </div>
    </div>
    {error&&<div className="admin-notice" role="alert">{error}</div>}
    {message&&<div className="admin-notice" role="status">{message}</div>}
    {loading?<p className="admin-no-data">جاري تحميل المستخدمين...</p>:<div className="admin-users-table-wrap">
      <table className="admin-users-table">
        <thead><tr><th>الإسم</th><th>رقم الهاتف</th><th>الدور</th><th>تاريخ التسجيل</th><th>تعديل الدور / الفعاليات المكلّف بها</th></tr></thead>
        <tbody>{rows.map((row,index)=>{
          const draftRole=roleDrafts[row.id]||row.role||"customer";
          const assignedIds=row.assignment_event_ids||((row.assignment_event_id)?[row.assignment_event_id]:[]);
          const selectedEvent=assignmentEventIds[row.id]??"";
          const protectedUser=row.role==="owner"||(role==="admin"&&row.role==="admin");
          const scoped=EVENT_SCOPED_ROLES.includes(draftRole);
          const needsInitialAssignment=scoped&&draftRole!==row.role;
          const canAddAssignment=scoped&&!!selectedEvent&&!assignedIds.includes(selectedEvent);
          const roleChanged=draftRole!==row.role;
          return <tr key={row.id||index}>
            <td data-label="الإسم"><strong>{fmt(row.full_name)}</strong></td>
            <td data-label="رقم الهاتف"><span dir="ltr">{fmt(row.phone)}</span><small className="admin-user-email" dir="ltr">{fmt(row.email)}</small></td>
            <td data-label="الدور"><span className="admin-user-role">{roleNames[row.role]||fmt(row.role)}</span></td>
            <td data-label="تاريخ التسجيل">{row.created_at?new Date(row.created_at).toLocaleDateString("ar-SD-u-nu-latn"):"—"}</td>
            <td data-label="تعديل الدور / الفعاليات المكلّف بها">
              <div className="admin-user-role-editor">
                <HaddirSelect ariaLabel={"تعديل دور "+(row.full_name||"المستخدم")} value={draftRole} disabled={updatingUserId===row.id||protectedUser} onChange={value=>{setRoleDrafts(current=>({...current,[row.id]:value}));setAssignmentEventIds(current=>({...current,[row.id]:""}));}} options={[
                  {value:"customer",label:"عميل"},
                  ...((role==="owner"||row.role==="admin")?[{value:"admin",label:"مشرف إداري"}]:[]),
                  {value:"supervisor",label:"مشرف فعالية"},{value:"gatekeeper",label:"منظم حاضر (بواب)"},{value:"advertiser",label:"مُعلن"},
                  ...(row.role==="organizer"?[{value:"organizer",label:"منظم حاضر"}]:[]),
                  ...(protectedUser?[{value:row.role,label:roleNames[row.role]||row.role}]:[])
                ]}/>
                {scoped&&<HaddirSelect ariaLabel="اختيار فعالية لإضافتها للتكليف" value={selectedEvent} disabled={updatingUserId===row.id} placeholder="اختر فعالية لإسنادها" onChange={value=>setAssignmentEventIds(current=>({...current,[row.id]:value}))} options={[{value:"",label:"اختر فعالية لإسنادها"},...eventOptions.map(option=>({value:option.id,label:option.title+" · "+(option.status==="draft"?"مسودة":option.status==="published"?"منشورة":option.status)}))]}/>}
                {!protectedUser&&<button type="button" className="admin-user-save-role" disabled={updatingUserId===row.id||(draftRole==="organizer")||(draftRole==="admin"&&role!=="owner")||(scoped&&(needsInitialAssignment?!selectedEvent:!canAddAssignment))||(!scoped&&!roleChanged)} onClick={()=>setPendingRole({row,nextRole:draftRole,eventId:scoped?selectedEvent:null})}>{updatingUserId===row.id?"جاري الحفظ…":scoped&&!needsInitialAssignment?"إضافة الفعالية":"حفظ الدور"}</button>}
              </div>
              {EVENT_SCOPED_ROLES.includes(row.role)&&assignedIds.length>0&&<div className="admin-user-event-assignments" aria-label="الفعاليات المكلّف بها">
                {assignedIds.map(eventId=><span className="admin-user-event-assignment" key={eventId}>
                  {eventName(eventId)}
                  {!protectedUser&&<button type="button" title="إلغاء التكليف بهذه الفعالية" aria-label={"إلغاء تكليف "+eventName(eventId)} disabled={updatingUserId===row.id} onClick={()=>void removeAssignment(row,eventId)}><X size={13}/></button>}
                </span>)}
              </div>}
              {updatingUserId===row.id&&<small className="admin-user-saving">جاري الحفظ…</small>}
            </td>
          </tr>;
        })}</tbody>
      </table>
      {rows.length===0&&<p className="admin-no-data">لا يوجد مستخدمون مسجلون حتى الآن.</p>}
    </div>}
    {pendingRole&&<HaddirDialog open title="تأكيد تغيير الصلاحية؟" description={EVENT_SCOPED_ROLES.includes(pendingRole.nextRole)&&pendingRole.row.role===pendingRole.nextRole
      ?"سيتم إضافة "+eventName(pendingRole.eventId||"")+" إلى فعاليات تكليف "+(pendingRole.row.full_name||"هذا المستخدم")+"."
      :"سيتم تغيير دور "+(pendingRole.row.full_name||"هذا المستخدم")+" إلى "+(roleNames[pendingRole.nextRole]||pendingRole.nextRole)+"."} confirmLabel={EVENT_SCOPED_ROLES.includes(pendingRole.nextRole)&&pendingRole.row.role===pendingRole.nextRole?"إضافة التكليف":"حفظ الصلاحية"} onCancel={()=>setPendingRole(null)} onConfirm={async()=>{const target=pendingRole;setPendingRole(null);await updateRole(target.row,target.nextRole,target.eventId);}}/>}
  </section>;
}
