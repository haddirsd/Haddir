"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import AdminEventCards from "./AdminEventCards";
import AdminEventBasicsEditor from "./AdminEventBasicsEditor";
import AdminEventPublishSettingsEditor from "./AdminEventPublishSettingsEditor";
import AdminEventAccountsEditor from "./AdminEventAccountsEditor";
import AdminEventTicketsEditor from "./AdminEventTicketsEditor";
import { HaddirDialog } from "../../../components/ui/HaddirDialog";
import { deleteOrCancelAdminEvent, markAdminEventCompleted, publishDraftAdminEvent } from "./admin-events.service";
import { useAdminEvents } from "./useAdminEvents";
import { useAdminEventEditor } from "./useAdminEventEditor";
import type { AdminEventRole, AdminEventRow } from "./admin-events.types";
import { SkeletonState } from "../../../components/ui/SkeletonState";


export default function AdminEventsWorkspace({ role }: { role: AdminEventRole }) {
  const { rows, page, setPage, totalCount, loading, loadError, refreshEvents: loadEvents } = useAdminEvents();
  const totalPages = Math.max(1, Math.ceil(totalCount / 25));
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
      setPendingAction({title:"تأكيد المحاسبة قبل حذف الفعالية",description:"هل حاسبت صاحب الفعالية واستلم كل طرف حقه، وتأكدت من عدم وجود حجوزات أو مدفوعات أو استردادات معلّقة للفعالية «"+r.title+"»؟ لا تتابع إلا بعد إتمام التسوية ومراجعة التقرير.",label:"نعم، تمت المحاسبة وأؤكد الحذف",tone:"danger",run:async()=>{
        setEventMessage("");
        const result = await deleteOrCancelAdminEvent(r.id);
        if (result.error) { setEventMessage(result.error); return; }
        setEventMessage(result.message);
        await loadEvents();
      }});
    };

    const completeEvent = async (r: AdminEventRow) => {
      if (!role || !["owner","admin"].includes(role)) return;
      setPendingAction({title:"إنهاء الفعالية؟",description:"سيتم إيقاف بيع التذاكر وإخفاء الفعالية من الفعاليات المتاحة للحجز. ستظل بياناتها محفوظة حتى تتم المحاسبة ثم تحذفها يدوياً.",label:"نعم، إنهاء الفعالية",tone:"danger",run:async()=>{
        const result = await markAdminEventCompleted(r.id);
        if (result.error) { setEventMessage(result.error); return; }
        setEventMessage("تم إنهاء الفعالية وإيقاف بيع تذاكرها.");
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
    {loading?<SkeletonState variant="admin-cards" count={4} label="جاري تحميل الفعاليات..." />:<AdminEventCards rows={rows} role={role} loading={loading} onEdit={editEvent} onDelete={deleteEvent} onPublish={publishEvent} onComplete={completeEvent}/>}
    {!loading && totalCount > 0 && <div className="admin-pagination" aria-label="صفحات الفعاليات">
      <span>عرض {Math.min((page - 1) * 25 + 1, totalCount).toLocaleString("ar-SD-u-nu-latn")}–{Math.min(page * 25, totalCount).toLocaleString("ar-SD-u-nu-latn")} من {totalCount.toLocaleString("ar-SD-u-nu-latn")} فعالية</span>
      <div className="admin-pagination-controls">
        <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1}>السابق</button>
        <span>صفحة {page.toLocaleString("ar-SD-u-nu-latn")} من {totalPages.toLocaleString("ar-SD-u-nu-latn")}</span>
        <button type="button" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>التالي</button>
      </div>
    </div>}
    {pendingAction&&<HaddirDialog open title={pendingAction.title} description={pendingAction.description} confirmLabel={pendingAction.label} tone={pendingAction.tone} onCancel={()=>setPendingAction(null)} onConfirm={async()=>{const action=pendingAction;setPendingAction(null);await action.run();}}/>}
  </section>;
}
