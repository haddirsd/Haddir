"use client";

import { useState, type FormEvent } from "react";
import { RefreshCw } from "lucide-react";
import AdminEventCards from "./AdminEventCards";
import AdminEventBasicsEditor from "./AdminEventBasicsEditor";
import AdminEventAccountsEditor from "./AdminEventAccountsEditor";
import AdminEventTicketsEditor from "./AdminEventTicketsEditor";
import { HaddirDialog } from "../../../components/ui/HaddirDialog";
import { deleteOrCancelAdminEvent, getAdminEventEditorData, publishDraftAdminEvent, saveAdminEvent } from "./admin-events.service";
import { useAdminEvents } from "./useAdminEvents";
import type { AdminEventAccountForm, AdminEventFormValues, AdminEventRole, AdminEventRow, AdminTicketForm } from "./admin-events.types";


export default function AdminEventsWorkspace({ role }: { role: AdminEventRole }) {
  const { rows, loading, loadError, refreshEvents: loadEvents } = useAdminEvents();
  const [showEventForm, setShowEventForm] = useState(false);
    const [pendingAction,setPendingAction]=useState<{title:string;description:string;label:string;tone:"primary"|"danger";run:()=>Promise<void>}|null>(null);
    const [savingEvent, setSavingEvent] = useState(false);
    const [eventMessage, setEventMessage] = useState("");
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const emptyEventForm = {title:"",description:"",category:"",city:"",venue:"",address:"",location_url:"",starts_at:"",ends_at:"",is_continuous:false,cover_image_url:"",is_trending:false,platform_fee_percent:"0"};
    const emptyTicket = ():AdminTicketForm => ({name:"تذكرة عامة",description:"",price:"",currency:"SDG",quantity_total:"",quantity_sold:0,sales_start_at:"",sales_end_at:"",is_active:true});
    const [ticketForms,setTicketForms] = useState<AdminTicketForm[]>([emptyTicket()]);
    const [eventAccountForms,setEventAccountForms]=useState<AdminEventAccountForm[]>([]);
    const [eventForm, setEventForm] = useState<AdminEventFormValues>(emptyEventForm);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState("");
  
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

    const editEvent = async (r: AdminEventRow) => {
      setEditingEventId(r.id);
      const localDate=(v:string|null)=>v?new Date(new Date(v).getTime()-new Date(v).getTimezoneOffset()*60000).toISOString().slice(0,16):"";
      setEventForm({...emptyEventForm,title:r.title||"",description:r.description||"",category:r.category||"",city:r.city||"",venue:r.venue||"",address:r.address||"",location_url:r.location_url||"",starts_at:localDate(r.starts_at),ends_at:localDate(r.ends_at),is_continuous:!!r.is_continuous,cover_image_url:r.cover_image_url||"",is_trending:!!r.is_trending,platform_fee_percent:String(r.platform_fee_percent??0)});
      setCoverFile(null);setCoverPreview(r.cover_image_url||"");
      setShowEventForm(true);setEventMessage("");
      const result = await getAdminEventEditorData(r.id);
      if (result.error || !result.data) { setEventMessage(result.error || "تعذر تحميل تفاصيل الفعالية."); return; }
      setEventAccountForms(result.data.paymentAccounts);
      setTicketForms(result.data.tickets.length ? result.data.tickets : [emptyTicket()]);
      window.scrollTo({top:0,behavior:"smooth"});
    };

    const createEvent = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!role || !["owner","admin"].includes(role)) return;
      setSavingEvent(true);
      setEventMessage("");
      try {
        const result = await saveAdminEvent({
          eventForm, ticketForms, eventAccountForms, coverFile, editingEventId,
        });
        if (result.error) { setEventMessage(result.error); return; }
        setEventMessage(result.message || "تم حفظ الفعالية بنجاح.");
        setEditingEventId(null);
        setEventForm(emptyEventForm);
        setTicketForms([emptyTicket()]);
        setEventAccountForms([]);
        setCoverFile(null);
        setCoverPreview("");
        setShowEventForm(false);
        await loadEvents();
      } catch (error) {
        setEventMessage(error instanceof Error ? error.message : "تعذر حفظ الفعالية.");
      } finally {
        setSavingEvent(false);
      }
    };



  return <section className="admin-panel">
    <div className="admin-panel-head">
      <div><h3>الفعاليات</h3><p>إدارة دورة الفعالية: البيانات، التذاكر، حسابات الدفع والنشر</p></div>
      <div className="admin-panel-actions">
        {(role==="owner"||role==="admin")&&<button className="admin-create-button admin-event-add" type="button" onClick={()=>{setShowEventForm(v=>!v);setEditingEventId(null);setEventForm(emptyEventForm);setTicketForms([emptyTicket()]);setEventAccountForms([]);setEventMessage("");}}>{showEventForm?"إغلاق":"＋ إضافة فعالية"}</button>}
        <button className="admin-refresh" type="button" onClick={()=>void loadEvents()} disabled={loading}><RefreshCw size={16}/> تحديث</button>
      </div>
    </div>
    {(eventMessage||loadError)&&<p className="admin-form-message" role="status">{eventMessage||loadError}</p>}
    {showEventForm&&<form className="admin-event-form admin-event-editor-page" onSubmit={createEvent}><header className="admin-event-editor-head"><div><span className="admin-event-editor-eyebrow">إدارة الفعاليات</span><h3>{editingEventId?"تعديل بيانات الفعالية":"إضافة فعالية جديدة"}</h3><p>أدخل بيانات الفعالية، ثم أضف التذاكر ووسائل الدفع الخاصة بها.</p></div><button type="button" className="admin-event-editor-close" onClick={()=>{setShowEventForm(false);setEditingEventId(null);setEventMessage("");}}>إغلاق</button></header><div className="admin-event-editor-body"><AdminEventBasicsEditor eventForm={eventForm} setEventForm={setEventForm} setCoverFile={setCoverFile} coverPreview={coverPreview} setCoverPreview={setCoverPreview}/><section className="admin-event-form-section"><div className="admin-event-section-title"><span>02</span><div><h4>الوصف وإعدادات النشر</h4><p>العمولة، وصف الفعالية، وظهورها في الصفحة الرئيسية.</p></div></div><div className="admin-form-grid"><label>نسبة عمولة المنصة (%) *<input type="number" min="0" max="100" step="0.01" required value={eventForm.platform_fee_percent} onChange={e=>setEventForm({...eventForm,platform_fee_percent:e.target.value})}/><small className="admin-form-hint">تُستخدم لحساب صافي عمولة حاضر في الإحصائيات.</small></label><label className="admin-form-wide">عن الفعالية<textarea rows={3} value={eventForm.description} onChange={e=>setEventForm({...eventForm,description:e.target.value})}/></label><label className="admin-trending-check"><input type="checkbox" checked={eventForm.is_trending} onChange={e=>setEventForm({...eventForm,is_trending:e.target.checked})}/> إظهار الفعالية في «رائج الآن»</label></div></section><AdminEventAccountsEditor forms={eventAccountForms} setForms={setEventAccountForms}/><AdminEventTicketsEditor forms={ticketForms} setForms={setTicketForms} emptyTicket={emptyTicket}/></div><footer className="admin-event-editor-footer"><button type="button" className="admin-event-editor-cancel" onClick={()=>setShowEventForm(false)}>إلغاء</button><button className="admin-create-button" type="submit" disabled={savingEvent}>{savingEvent?"جاري الحفظ...":editingEventId?"حفظ التعديلات":"حفظ الفعالية"}</button></footer></form>}
    {loading?<p className="admin-no-data">جاري تحميل البيانات...</p>:<AdminEventCards rows={rows} role={role} loading={loading} onEdit={editEvent} onDelete={deleteEvent} onPublish={publishEvent}/>}
    {pendingAction&&<HaddirDialog open title={pendingAction.title} description={pendingAction.description} confirmLabel={pendingAction.label} tone={pendingAction.tone} onCancel={()=>setPendingAction(null)} onConfirm={async()=>{const action=pendingAction;setPendingAction(null);await action.run();}}/>}
  </section>;
}
