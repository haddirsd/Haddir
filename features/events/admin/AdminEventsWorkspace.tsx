"use client";

import { useState, type FormEvent } from "react";
import { RefreshCw } from "lucide-react";
import { getSupabaseBrowserClient } from "../../../lib/supabase";
import { saveAdminEvent } from "./admin-events.service";
import { deleteOrCancelAdminEvent, getAdminEventEditorData, publishDraftAdminEvent } from "./admin-events.service";
import { useAdminEvents } from "./useAdminEvents";
import type { AdminEventAccountForm, AdminEventFormValues, AdminEventRole, AdminEventRow, AdminTicketForm } from "./admin-events.types";


const statusLabels: Record<string, string> = { draft:"مسودة", published:"منشورة", cancelled:"ملغاة", completed:"مكتملة" };
const fmt = (v: unknown) => v == null || v === "" ? "—" : String(v);

export default function AdminEventsWorkspace({ role }: { role: AdminEventRole }) {
  const { rows, loading, loadError, refreshEvents: loadEvents } = useAdminEvents();
  const [showEventForm, setShowEventForm] = useState(false);
    const [savingEvent, setSavingEvent] = useState(false);
    const [eventMessage, setEventMessage] = useState("");
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const emptyEventForm = {title:"",description:"",category:"",city:"",venue:"",address:"",location_url:"",starts_at:"",ends_at:"",cover_image_url:"",is_trending:false,platform_fee_percent:"0"};
    const emptyTicket = ():AdminTicketForm => ({name:"تذكرة عامة",description:"",price:"",currency:"SDG",quantity_total:"",quantity_sold:0,sales_start_at:"",sales_end_at:"",is_active:true});
    const [ticketForms,setTicketForms] = useState<AdminTicketForm[]>([emptyTicket()]);
    const [eventAccountForms,setEventAccountForms]=useState<AdminEventAccountForm[]>([]);
    const [eventForm, setEventForm] = useState<AdminEventFormValues>(emptyEventForm);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState("");
  
    const deleteEvent = async (r: AdminEventRow) => {
      if (!role || !["owner","admin"].includes(role)) return;
      if (!window.confirm("حذف الفعالية «"+r.title+"»؟ إذا كانت مرتبطة بحجوزات أو تذاكر صادرة فسيتم إلغاؤها وإخفاؤها مع الاحتفاظ بالسجلات المالية والتذاكر السابقة.")) return;
      setEventMessage("");
      const result = await deleteOrCancelAdminEvent(r.id);
      if (result.error) { setEventMessage(result.error); return; }
      setEventMessage(result.message);
      await loadEvents();
    };

    const publishEvent = async (eventId: string) => {
      if (!role || !["owner","admin"].includes(role)) return;
      if (!window.confirm("هل تريد نشر هذه الفعالية الآن؟ ستصبح ظاهرة للزوار.")) return;
      const result = await publishDraftAdminEvent(eventId);
      if (result.error) { setEventMessage(result.error); return; }
      setEventMessage("تم إرسال طلب النشر بنجاح.");
      await loadEvents();
    };

    const editEvent = async (r: AdminEventRow) => {
      setEditingEventId(r.id);
      const localDate=(v:string|null)=>v?new Date(new Date(v).getTime()-new Date(v).getTimezoneOffset()*60000).toISOString().slice(0,16):"";
      setEventForm({...emptyEventForm,title:r.title||"",description:r.description||"",category:r.category||"",city:r.city||"",venue:r.venue||"",address:r.address||"",location_url:r.location_url||"",starts_at:localDate(r.starts_at),ends_at:localDate(r.ends_at),cover_image_url:r.cover_image_url||"",is_trending:!!r.is_trending,platform_fee_percent:String(r.platform_fee_percent??0)});
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
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !role || !["owner","admin"].includes(role)) return;
      setSavingEvent(true);
      setEventMessage("");
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setEventMessage("انتهت الجلسة، سجل الدخول مرة أخرى."); return; }
        const result = await saveAdminEvent({
          userId: user.id, eventForm, ticketForms, eventAccountForms, coverFile, editingEventId,
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

  const eventCards = <div className="admin-event-cards">
        {rows.length===0?<p className="admin-no-data">لا توجد فعاليات حتى الآن. أضف أول فعالية من الزر بالأعلى.</p>:rows.map((r,i)=><article className="admin-event-card" key={r.id||i}>
          <div className="admin-event-card-main">
            <div className="admin-event-card-title"><h4>{r.title||"فعالية بدون عنوان"}</h4><span className={"admin-event-status status-"+(r.status||"draft")}>{statusLabels[r.status]||fmt(r.status)}</span></div>
            <div className="admin-event-card-meta"><span><b>التصنيف:</b> {fmt(r.category)}</span><span><b>المدينة:</b> {fmt(r.city)}</span><span><b>المكان:</b> {fmt(r.venue)}</span><span><b>الموعد:</b> {r.starts_at?new Date(r.starts_at).toLocaleString("ar-SD"):"—"}</span></div>
          </div>
          {(role==="owner"||role==="admin")&&<div className="admin-event-card-actions">
            <button className="admin-event-edit" type="button" disabled={loading} onClick={()=>editEvent(r)}>تعديل</button>
            <button className="admin-event-delete" type="button" disabled={loading} onClick={()=>void deleteEvent(r)}>حذف</button>
            {r.status==="draft"?<button className="admin-create-button" type="button" disabled={loading} onClick={()=>void publishEvent(r.id)}>نشر الفعالية</button>:null}
            {r.is_trending?<small>رائج الآن</small>:null}
          </div>}
        </article>)}
      </div>;

  return <section className="admin-panel">
    <div className="admin-panel-head">
      <div><h3>الفعاليات</h3><p>إدارة دورة الفعالية: البيانات، التذاكر، حسابات الدفع والنشر</p></div>
      <div className="admin-panel-actions">
        {(role==="owner"||role==="admin")&&<button className="admin-create-button admin-event-add" type="button" onClick={()=>{setShowEventForm(v=>!v);setEditingEventId(null);setEventForm(emptyEventForm);setTicketForms([emptyTicket()]);setEventAccountForms([]);setEventMessage("");}}>{showEventForm?"إغلاق":"＋ إضافة فعالية"}</button>}
        <button className="admin-refresh" type="button" onClick={()=>void loadEvents()} disabled={loading}><RefreshCw size={16}/> تحديث</button>
      </div>
    </div>
    {(eventMessage||loadError)&&<p className="admin-form-message" role="status">{eventMessage||loadError}</p>}
    {showEventForm&&<form className="admin-event-form" onSubmit={createEvent}><h3>{editingEventId?"تعديل بيانات الفعالية":"بيانات الفعالية"}</h3><div className="admin-form-grid"><label>اسم الفعالية *<input required value={eventForm.title} onChange={e=>setEventForm({...eventForm,title:e.target.value})}/></label><label>المدينة *<input required value={eventForm.city} onChange={e=>setEventForm({...eventForm,city:e.target.value})}/></label><label>المكان *<input required value={eventForm.venue} onChange={e=>setEventForm({...eventForm,venue:e.target.value})}/></label><label>العنوان التفصيلي<input value={eventForm.address} onChange={e=>setEventForm({...eventForm,address:e.target.value})}/></label><label>رابط الموقع / Google Maps<input type="url" placeholder="https://maps.google.com/..." value={eventForm.location_url} onChange={e=>setEventForm({...eventForm,location_url:e.target.value})}/></label><label className="admin-form-wide">صورة الغلاف (من جهازك)<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0]||null;setCoverFile(file);if(file){const url=URL.createObjectURL(file);setCoverPreview(url);}else{setCoverPreview(eventForm.cover_image_url);}}}/><small className="admin-form-hint">الصيغ المدعومة حسب المتصفح · الحد الأقصى 10 MB · تُرفع الصورة الأصلية دون ضغط.</small></label>{coverPreview&&<div className="admin-cover-preview"><img src={coverPreview} alt="معاينة صورة الغلاف"/><button type="button" onClick={()=>{setCoverFile(null);setCoverPreview("");setEventForm({...eventForm,cover_image_url:""});}}>إزالة الصورة</button></div>}<label>الزمان / تاريخ ووقت البداية *<input type="datetime-local" required value={eventForm.starts_at} onChange={e=>setEventForm({...eventForm,starts_at:e.target.value})}/></label><label>تاريخ ووقت النهاية<input type="datetime-local" value={eventForm.ends_at} onChange={e=>setEventForm({...eventForm,ends_at:e.target.value})}/></label></div><label>نسبة عمولة المنصة (%) *<input type="number" min="0" max="100" step="0.01" required value={eventForm.platform_fee_percent} onChange={e=>setEventForm({...eventForm,platform_fee_percent:e.target.value})}/><small className="admin-form-hint">تُستخدم لحساب صافي عمولة حاضر في الإحصائيات.</small></label><label className="admin-form-wide">عن الفعالية<textarea rows={3} value={eventForm.description} onChange={e=>setEventForm({...eventForm,description:e.target.value})}/></label><label className="admin-trending-check"><input type="checkbox" checked={eventForm.is_trending} onChange={e=>setEventForm({...eventForm,is_trending:e.target.checked})}/> إظهار الفعالية في «رائج الآن»</label><section className="admin-ticket-editor"><div className="admin-ticket-heading"><h3>حسابات التحويل الخاصة بالفعالية</h3><button type="button" className="admin-create-button" onClick={()=>setEventAccountForms(v=>[...v,{account_name:"",account_number:"",beneficiary:"",is_active:true,sort_order:(v.length+1)*10}])}>＋ إضافة حساب</button></div>{eventAccountForms.map((a,i)=><div className="admin-ticket-row" key={a.id||"event-account-"+i}><div className="admin-form-grid"><label>اسم البنك أو طريقة الدفع *<input value={a.account_name} onChange={e=>setEventAccountForms(v=>v.map((x,j)=>j===i?{...x,account_name:e.target.value}:x))}/></label><label>رقم الحساب *<input dir="ltr" value={a.account_number} onChange={e=>setEventAccountForms(v=>v.map((x,j)=>j===i?{...x,account_number:e.target.value}:x))}/></label><label>اسم المستفيد *<input value={a.beneficiary} onChange={e=>setEventAccountForms(v=>v.map((x,j)=>j===i?{...x,beneficiary:e.target.value}:x))}/></label><label className="admin-trending-check"><input type="checkbox" checked={a.is_active} onChange={e=>setEventAccountForms(v=>v.map((x,j)=>j===i?{...x,is_active:e.target.checked}:x))}/> متاح للحجز</label><button type="button" className="admin-delete-button" onClick={()=>setEventAccountForms(v=>v.filter((_,j)=>j!==i))}>إزالة الحساب</button></div></div>)}</section><div className="admin-ticket-editor"><div className="admin-ticket-heading"><h3>أنواع التذاكر</h3><button type="button" className="admin-create-button" onClick={()=>setTicketForms(v=>[...v,emptyTicket()])}>＋ إضافة فئة تذكرة</button></div>{ticketForms.map((t,i)=><div className="admin-ticket-row" key={t.id||"new-"+i}><div className="admin-ticket-row-head"><b>الفئة {i+1}</b>{ticketForms.length>1&&<button type="button" className="admin-delete-button" onClick={()=>setTicketForms(v=>v.filter((_,j)=>j!==i))}>إزالة</button>}</div><div className="admin-form-grid"><label>اسم التذكرة *<input required value={t.name} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,name:e.target.value}:x))}/></label><label>الوصف (اختياري)<input value={t.description} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,description:e.target.value}:x))}/></label><label>السعر *<input type="number" min="0" step="0.01" required value={t.price} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,price:e.target.value}:x))}/></label><label>العملة<select value={t.currency} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,currency:e.target.value}:x))}><option value="SDG">جنيه سوداني (SDG)</option><option value="SAR">ريال سعودي (SAR)</option><option value="AED">درهم إماراتي (AED)</option><option value="USD">دولار أمريكي (USD)</option><option value="EGP">جنيه مصري (EGP)</option></select></label><label>الكمية المتاحة *<input type="number" min={t.quantity_sold||1} step="1" required value={t.quantity_total} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,quantity_total:e.target.value}:x))}/></label><label>بداية البيع<input type="datetime-local" value={t.sales_start_at} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,sales_start_at:e.target.value}:x))}/></label><label>نهاية البيع<input type="datetime-local" value={t.sales_end_at} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,sales_end_at:e.target.value}:x))}/></label><label className="admin-trending-check"><input type="checkbox" checked={t.is_active} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,is_active:e.target.checked}:x))}/> الفئة مفعّلة للحجز</label>{t.quantity_sold>0&&<small className="admin-form-hint">تم بيع {t.quantity_sold} — لا يمكن تقليل الكمية عنها.</small>}</div></div>)}</div><p className="admin-form-hint">سيتم حفظ الفعالية كمسودة، ولن تظهر للجمهور إلا بعد نشرها.</p>{eventMessage&&<p className="admin-form-message" role="status">{eventMessage}</p>}<button className="admin-create-button" type="submit" disabled={savingEvent}>{savingEvent?"جاري الحفظ...":editingEventId?"حفظ التعديلات":"حفظ الفعالية"}</button></form>}
    {loading?<p className="admin-no-data">جاري تحميل البيانات...</p>:eventCards}
  </section>;
}
