"use client";

import { useState, type FormEvent } from "react";
import { RefreshCw } from "lucide-react";
import AdminEventCards from "./AdminEventCards";
import { HaddirDialog } from "../../../components/ui/HaddirDialog";
import { HaddirSelect } from "../../../components/ui/HaddirSelect";
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
    {showEventForm&&<form className="admin-event-form admin-event-editor-page" onSubmit={createEvent}><header className="admin-event-editor-head"><div><span className="admin-event-editor-eyebrow">إدارة الفعاليات</span><h3>{editingEventId?"تعديل بيانات الفعالية":"إضافة فعالية جديدة"}</h3><p>أدخل بيانات الفعالية، ثم أضف التذاكر ووسائل الدفع الخاصة بها.</p></div><button type="button" className="admin-event-editor-close" onClick={()=>{setShowEventForm(false);setEditingEventId(null);setEventMessage("");}}>إغلاق</button></header><div className="admin-event-editor-body"><section className="admin-event-form-section"><div className="admin-event-section-title"><span>01</span><div><h4>المعلومات الأساسية</h4><p>اسم الفعالية وتصنيفها ومكان إقامتها.</p></div></div><div className="admin-form-grid"><label>اسم الفعالية *<input required value={eventForm.title} onChange={e=>setEventForm({...eventForm,title:e.target.value})}/></label><label>فئة الفعالية<input value={eventForm.category} onChange={e=>setEventForm({...eventForm,category:e.target.value})} placeholder="مثال: موسيقى وحفلات، رياضة، مسرح"/><small className="admin-form-hint">تظهر الفئة ضمن بيانات الفعالية للزوار.</small></label><label>المدينة *<input required value={eventForm.city} onChange={e=>setEventForm({...eventForm,city:e.target.value})}/></label><label>المكان *<input required value={eventForm.venue} onChange={e=>setEventForm({...eventForm,venue:e.target.value})}/></label><label>العنوان التفصيلي<input value={eventForm.address} onChange={e=>setEventForm({...eventForm,address:e.target.value})}/></label><label>رابط الموقع / Google Maps<input type="url" placeholder="https://maps.google.com/..." value={eventForm.location_url} onChange={e=>setEventForm({...eventForm,location_url:e.target.value})}/></label><label className="admin-form-wide">صورة الغلاف (من جهازك)<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0]||null;setCoverFile(file);if(file){const url=URL.createObjectURL(file);setCoverPreview(url);}else{setCoverPreview(eventForm.cover_image_url);}}}/><small className="admin-form-hint">الصيغ المدعومة حسب المتصفح · الحد الأقصى 10 MB · تُرفع الصورة الأصلية دون ضغط.</small></label>{coverPreview&&<div className="admin-cover-preview"><img src={coverPreview} alt="معاينة صورة الغلاف"/><button type="button" onClick={()=>{setCoverFile(null);setCoverPreview("");setEventForm({...eventForm,cover_image_url:""});}}>إزالة الصورة</button></div>}<div className="admin-form-date-row"><label>الزمان / تاريخ ووقت البداية {!eventForm.is_continuous&&"*" }<input type="datetime-local" required={!eventForm.is_continuous} disabled={eventForm.is_continuous} value={eventForm.starts_at} onChange={e=>setEventForm({...eventForm,starts_at:e.target.value})}/></label><label className="admin-trending-check admin-continuous-check"><input type="checkbox" checked={eventForm.is_continuous} onChange={e=>setEventForm({...eventForm,is_continuous:e.target.checked,starts_at:e.target.checked?"":eventForm.starts_at,ends_at:e.target.checked?"":eventForm.ends_at})}/> <span>تذكرة مستمرة</span></label><label>تاريخ ووقت النهاية<input type="datetime-local" disabled={eventForm.is_continuous} value={eventForm.ends_at} onChange={e=>setEventForm({...eventForm,ends_at:e.target.value})}/></label></div><small className="admin-form-hint">فعّل «تذكرة مستمرة» للتذاكر غير المقيدة بتاريخ أو زمن محدد، مثل الحدائق والألعاب.</small></div></section><section className="admin-event-form-section"><div className="admin-event-section-title"><span>02</span><div><h4>الوصف وإعدادات النشر</h4><p>العمولة، وصف الفعالية، وظهورها في الصفحة الرئيسية.</p></div></div><div className="admin-form-grid"><label>نسبة عمولة المنصة (%) *<input type="number" min="0" max="100" step="0.01" required value={eventForm.platform_fee_percent} onChange={e=>setEventForm({...eventForm,platform_fee_percent:e.target.value})}/><small className="admin-form-hint">تُستخدم لحساب صافي عمولة حاضر في الإحصائيات.</small></label><label className="admin-form-wide">عن الفعالية<textarea rows={3} value={eventForm.description} onChange={e=>setEventForm({...eventForm,description:e.target.value})}/></label><label className="admin-trending-check"><input type="checkbox" checked={eventForm.is_trending} onChange={e=>setEventForm({...eventForm,is_trending:e.target.checked})}/> إظهار الفعالية في «رائج الآن»</label></div></section><section className="admin-event-form-section admin-event-form-section-nested"><div className="admin-event-section-title"><span>03</span><div><h4>حسابات التحويل</h4><p>وسائل الدفع وأرقام الحسابات الخاصة بهذه الفعالية.</p></div></div><section className="admin-ticket-editor"><div className="admin-ticket-heading"><h3>حسابات التحويل الخاصة بالفعالية</h3><button type="button" className="admin-create-button" onClick={()=>setEventAccountForms(v=>[...v,{account_name:"",account_number:"",beneficiary:"",is_active:true,sort_order:(v.length+1)*10}])}>＋ إضافة حساب</button></div>{eventAccountForms.map((a,i)=><div className="admin-ticket-row" key={a.id||"event-account-"+i}><div className="admin-form-grid"><label>اسم البنك أو طريقة الدفع *<input value={a.account_name} onChange={e=>setEventAccountForms(v=>v.map((x,j)=>j===i?{...x,account_name:e.target.value}:x))}/></label><label>رقم الحساب *<input dir="ltr" value={a.account_number} onChange={e=>setEventAccountForms(v=>v.map((x,j)=>j===i?{...x,account_number:e.target.value}:x))}/></label><label>اسم المستفيد *<input value={a.beneficiary} onChange={e=>setEventAccountForms(v=>v.map((x,j)=>j===i?{...x,beneficiary:e.target.value}:x))}/></label><label className="admin-trending-check"><input type="checkbox" checked={a.is_active} onChange={e=>setEventAccountForms(v=>v.map((x,j)=>j===i?{...x,is_active:e.target.checked}:x))}/> متاح للحجز</label><button type="button" className="admin-delete-button" onClick={()=>setEventAccountForms(v=>v.filter((_,j)=>j!==i))}>إزالة الحساب</button></div></div>)}</section></section><section className="admin-event-form-section admin-event-form-section-nested"><div className="admin-event-section-title"><span>04</span><div><h4>فئات التذاكر</h4><p>حدد أسعار الفئات والكميات وفترة البيع.</p></div></div><div className="admin-ticket-editor"><div className="admin-ticket-heading"><h3>أنواع التذاكر</h3><button type="button" className="admin-create-button" onClick={()=>setTicketForms(v=>[...v,emptyTicket()])}>＋ إضافة فئة تذكرة</button></div>{ticketForms.map((t,i)=><div className="admin-ticket-row" key={t.id||"new-"+i}><div className="admin-ticket-row-head"><b>الفئة {i+1}</b>{ticketForms.length>1&&<button type="button" className="admin-delete-button" onClick={()=>setTicketForms(v=>v.filter((_,j)=>j!==i))}>إزالة</button>}</div><div className="admin-form-grid"><label>اسم التذكرة *<input required value={t.name} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,name:e.target.value}:x))}/></label><label>الوصف (اختياري)<input value={t.description} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,description:e.target.value}:x))}/></label><label>السعر *<input type="number" min="0" step="0.01" required value={t.price} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,price:e.target.value}:x))}/></label><label>العملة<HaddirSelect value={t.currency} onChange={value=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,currency:value}:x))} options={[{value:"SDG",label:"جنيه سوداني (SDG)"},{value:"SAR",label:"ريال سعودي (SAR)"},{value:"AED",label:"درهم إماراتي (AED)"},{value:"USD",label:"دولار أمريكي (USD)"},{value:"EGP",label:"جنيه مصري (EGP)"}]}/></label><label>الكمية المتاحة (اختياري)<input type="number" min={t.quantity_sold||1} step="1" value={t.quantity_total} placeholder="فارغ = غير محدود" onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,quantity_total:e.target.value}:x))}/><small className="admin-form-hint">اتركها فارغة إذا كانت التذاكر غير محدودة الكمية.</small></label><label>بداية البيع<input type="datetime-local" value={t.sales_start_at} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,sales_start_at:e.target.value}:x))}/></label><label>نهاية البيع<input type="datetime-local" value={t.sales_end_at} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,sales_end_at:e.target.value}:x))}/></label><label className="admin-trending-check"><input type="checkbox" checked={t.is_active} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,is_active:e.target.checked}:x))}/> الفئة مفعّلة للحجز</label>{t.quantity_sold>0&&<small className="admin-form-hint">تم بيع {t.quantity_sold} — لا يمكن تقليل الكمية عنها.</small>}</div></div>)}</div><p className="admin-form-hint">سيتم حفظ الفعالية كمسودة، ولن تظهر للجمهور إلا بعد نشرها.</p>{eventMessage&&<p className="admin-form-message" role="status">{eventMessage}</p>}</section></div><footer className="admin-event-editor-footer"><button type="button" className="admin-event-editor-cancel" onClick={()=>setShowEventForm(false)}>إلغاء</button><button className="admin-create-button" type="submit" disabled={savingEvent}>{savingEvent?"جاري الحفظ...":editingEventId?"حفظ التعديلات":"حفظ الفعالية"}</button></footer></form>}
    {loading?<p className="admin-no-data">جاري تحميل البيانات...</p>:<AdminEventCards rows={rows} role={role} loading={loading} onEdit={editEvent} onDelete={deleteEvent} onPublish={publishEvent}/>}
    {pendingAction&&<HaddirDialog open title={pendingAction.title} description={pendingAction.description} confirmLabel={pendingAction.label} tone={pendingAction.tone} onCancel={()=>setPendingAction(null)} onConfirm={async()=>{const action=pendingAction;setPendingAction(null);await action.run();}}/>}
  </section>;
}
