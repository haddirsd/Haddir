"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import AdminEventCards from "./AdminEventCards";
import AdminEventBasicsEditor from "./AdminEventBasicsEditor";
import AdminEventPublishSettingsEditor from "./AdminEventPublishSettingsEditor";
import AdminEventAccountsEditor from "./AdminEventAccountsEditor";
import AdminEventTicketsEditor from "./AdminEventTicketsEditor";
import { HaddirDialog } from "../../../components/ui/HaddirDialog";
import { deleteOrCancelAdminEvent, publishDraftAdminEvent } from "./admin-events.service";
import { useAdminEvents } from "./useAdminEvents";
import { useAdminEventEditor } from "./useAdminEventEditor";
import type { AdminEventRole, AdminEventRow } from "./admin-events.types";


export default function AdminEventsWorkspace({ role }: { role: AdminEventRole }) {
  const { rows, loading, loadError, refreshEvents: loadEvents } = useAdminEvents();
  const [pendingAction, setPendingAction] = useState<{ title: string; description: string; label: string; tone: "primary" | "danger"; run: () => Promise<void> } | null>(null);
  const editor = useAdminEventEditor(role, loadEvents);
  const {
    showEventForm, setShowEventForm, savingEvent, eventMessage, setEventMessage, editingEventId,
    ticketForms, setTicketForms, eventAccountForms, setEventAccountForms,
    eventForm, setEventForm, coverFile, setCoverFile, coverPreview, setCoverPreview,
    emptyTicket, toggleEventForm, closeEventForm, editEvent, createEvent,
  } = editor;

    const deleteEvent = async (r: AdminEventRow) => {
      if (!role || !["owner","admin"].includes(role)) return;
      setPendingAction({title:"حذف الفعالية؟",description:"حذف «"+r.title+"». إذا كانت مرتبطة بحجوزات أو تذاكر صادرة فسيتم إلغاؤها وإخفاؤها مع الاحتفاظ بالسجلات المالية والتذاكر السابقة.",label:"حذف الفعالية",tone:"danger",run:async()=>{
        setEventMessage("");
        const result = await deleteOrCancelAdminEvent(r.id);
        if (result.error) { setEventMessage(result.error); return; }
        setEventMessage(result.message);
        await loadEvents();
      }});
    };

    const publishEvent = async (eventId: string) => {
      if (!role || !["owner","admin"].includes(role)) return;
      setPendingAction({title:"نشر الفعالية؟",description:"هل تريد نشر هذه الفعالية الآن؟ ستصبح ظاهرة للزوار.",label:"نشر الفعالية",tone:"primary",run:async()=>{
        const result = await publishDraftAdminEvent(eventId);
        if (result.error) { setEventMessage(result.error); return; }
        setEventMessage("تم إرسال طلب النشر بنجاح.");
        await loadEvents();
      }});
    };




  return <section className="admin-panel">
    <div className="admin-panel-head">
      <div><h3>الفعاليات</h3><p>إدارة دورة الفعالية: البيانات، التذاكر، حسابات الدفع والنشر</p></div>
      <div className="admin-panel-actions">
        {(role==="owner"||role==="admin")&&<button className="admin-create-button admin-event-add" type="button" onClick={toggleEventForm}>{showEventForm?"إغلاق":"＋ إضافة فعالية"}</button>}
        <button className="admin-refresh" type="button" onClick={()=>void loadEvents()} disabled={loading}><RefreshCw size={16}/> تحديث</button>
      </div>
    </div>
    {(eventMessage||loadError)&&<p className="admin-form-message" role="status">{eventMessage||loadError}</p>}
    {showEventForm&&<form className="admin-event-form admin-event-editor-page" onSubmit={createEvent}><header className="admin-event-editor-head"><div><span className="admin-event-editor-eyebrow">إدارة الفعاليات</span><h3>{editingEventId?"تعديل بيانات الفعالية":"إضافة فعالية جديدة"}</h3><p>أدخل بيانات الفعالية، ثم أضف التذاكر ووسائل الدفع الخاصة بها.</p></div><button type="button" className="admin-event-editor-close" onClick={closeEventForm}>إغلاق</button></header><div className="admin-event-editor-body"><AdminEventBasicsEditor eventForm={eventForm} setEventForm={setEventForm} setCoverFile={setCoverFile} coverPreview={coverPreview} setCoverPreview={setCoverPreview}/><AdminEventPublishSettingsEditor eventForm={eventForm} setEventForm={setEventForm}/><AdminEventAccountsEditor forms={eventAccountForms} setForms={setEventAccountForms}/><AdminEventTicketsEditor forms={ticketForms} setForms={setTicketForms} emptyTicket={emptyTicket}/></div><footer className="admin-event-editor-footer"><button type="button" className="admin-event-editor-cancel" onClick={()=>setShowEventForm(false)}>إلغاء</button><button className="admin-create-button" type="submit" disabled={savingEvent}>{savingEvent?"جاري الحفظ...":editingEventId?"حفظ التعديلات":"حفظ الفعالية"}</button></footer></form>}
    {loading?<p className="admin-no-data">جاري تحميل البيانات...</p>:<AdminEventCards rows={rows} role={role} loading={loading} onEdit={editEvent} onDelete={deleteEvent} onPublish={publishEvent}/>}
    {pendingAction&&<HaddirDialog open title={pendingAction.title} description={pendingAction.description} confirmLabel={pendingAction.label} tone={pendingAction.tone} onCancel={()=>setPendingAction(null)} onConfirm={async()=>{const action=pendingAction;setPendingAction(null);await action.run();}}/>}
  </section>;
}
