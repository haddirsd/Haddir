"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";
import { getSupabaseBrowserClient } from "../../../lib/supabase";

type AdminRole = "owner" | "admin" | "supervisor";
type Row = Record<string, any>;

const statusLabels: Record<string, string> = { draft:"مسودة", published:"منشورة", cancelled:"ملغاة", completed:"مكتملة" };
const fmt = (v: unknown) => v == null || v === "" ? "—" : String(v);

export default function AdminEventsWorkspace({ role }: { role: AdminRole }) {
  const [rows,setRows]=useState<Row[]>([]);
  const [loading,setLoading]=useState(false);
  const [showEventForm,setShowEventForm]=useState(false);
  const [savingEvent,setSavingEvent]=useState(false);
  const [eventMessage,setEventMessage]=useState("");
  const [editingEventId,setEditingEventId]=useState<string|null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
    const [savingEvent, setSavingEvent] = useState(false);
    const [eventMessage, setEventMessage] = useState("");
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const emptyEventForm = {title:"",description:"",category:"",city:"",venue:"",address:"",location_url:"",starts_at:"",ends_at:"",cover_image_url:"",is_trending:false,platform_fee_percent:"0"};
    type TicketForm = {id?:string;name:string;description:string;price:string;currency:string;quantity_total:string;quantity_sold:number;sales_start_at:string;sales_end_at:string;is_active:boolean};
    const emptyTicket = ():TicketForm => ({name:"تذكرة عامة",description:"",price:"",currency:"SDG",quantity_total:"",quantity_sold:0,sales_start_at:"",sales_end_at:"",is_active:true});
    const [ticketForms,setTicketForms] = useState<TicketForm[]>([emptyTicket()]);
    type EventAccountForm={id?:string;account_name:string;account_number:string;beneficiary:string;is_active:boolean;sort_order:number};
    const [eventAccountForms,setEventAccountForms]=useState<EventAccountForm[]>([]);
    const [eventForm, setEventForm] = useState(emptyEventForm);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState("");
  
  const loadEvents = async () => {
    const supabase=getSupabaseBrowserClient();
    if(!supabase)return;
    setLoading(true);
    const {data,error}=await supabase.from("events").select("id,title,category,city,venue,starts_at,status,created_at,is_trending,description,address,location_url,ends_at,cover_image_url,platform_fee_percent").order("created_at",{ascending:false}).limit(100);
    setLoading(false);
    if(error){setEventMessage("تعذر تحميل الفعاليات: "+error.message);return;}
    setRows(data||[]);
  };

  useEffect(()=>{
    void loadEvents();
    const supabase=getSupabaseBrowserClient();
    if(!supabase)return;
    const channel=supabase.channel("admin-events-workspace")
      .on("postgres_changes",{event:"*",schema:"public",table:"events"},()=>void loadEvents())
      .on("postgres_changes",{event:"*",schema:"public",table:"ticket_types"},()=>void loadEvents())
      .on("postgres_changes",{event:"*",schema:"public",table:"event_payment_accounts"},()=>void loadEvents())
      .subscribe();
    return()=>{void supabase.removeChannel(channel);};
  },[]);

    const deleteEvent = async (r:Row) => {
      const supabase=getSupabaseBrowserClient();if(!supabase||!role||!["owner","admin"].includes(role))return;
      if(!window.confirm("حذف الفعالية «"+r.title+"»؟ إذا كانت مرتبطة بحجوزات أو تذاكر صادرة فسيتم إلغاؤها وإخفاؤها مع الاحتفاظ بالسجلات المالية والتذاكر السابقة."))return;
      setLoading(true);
      const [{count:bookings},{count:tickets}] = await Promise.all([
        supabase.from("bookings").select("id",{count:"exact",head:true}).eq("event_id",r.id),
        supabase.from("tickets").select("id",{count:"exact",head:true}).eq("event_id",r.id)
      ]);
      if((bookings||0)>0||(tickets||0)>0){
        const {error}=await supabase.from("events").update({status:"cancelled",is_trending:false}).eq("id",r.id);
        if(!error) await supabase.from("ticket_types").update({is_active:false}).eq("event_id",r.id);
        setLoading(false);if(error){setEventMessage("تعذر إلغاء الفعالية: "+error.message);return;}
        setEventMessage("الفعالية مرتبطة بحجوزات/تذاكر؛ ألغيناها وأخفيناها مع الاحتفاظ بالسجلات.");await loadEvents();return;
      }
      const {error}=await supabase.from("events").delete().eq("id",r.id);
      setLoading(false);if(error){setEventMessage("تعذر حذف الفعالية: "+error.message);return;}
      setEventMessage("تم حذف الفعالية نهائياً.");await loadEvents();
    };
  
    const publishEvent = async (eventId: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !role || !["owner","admin"].includes(role)) return;
      const confirmed = window.confirm("هل تريد نشر هذه الفعالية الآن؟ ستصبح ظاهرة للزوار.");
      if (!confirmed) return;
      setLoading(true);
      const { error } = await supabase.from("events").update({ status: "published" }).eq("id", eventId).eq("status", "draft");
      setLoading(false);
      if (error) { setEventMessage("تعذر نشر الفعالية: " + error.message); return; }
      setEventMessage("تم إرسال طلب النشر بنجاح.");
      await loadEvents();
    };
  
    const editEvent = (r: Row) => {
      setEditingEventId(r.id);
      const localDate=(v:string|null)=>v?new Date(new Date(v).getTime()-new Date(v).getTimezoneOffset()*60000).toISOString().slice(0,16):"";
      setEventForm({...emptyEventForm,title:r.title||"",description:r.description||"",category:r.category||"",city:r.city||"",venue:r.venue||"",address:r.address||"",location_url:r.location_url||"",starts_at:localDate(r.starts_at),ends_at:localDate(r.ends_at),cover_image_url:r.cover_image_url||"",is_trending:!!r.is_trending,platform_fee_percent:String(r.platform_fee_percent??0)});
      setCoverFile(null);setCoverPreview(r.cover_image_url||"");
      const supabase=getSupabaseBrowserClient();
      void (async()=>{if(!supabase)return;const {data:accounts,error:accountsError}=await supabase.from("event_payment_accounts").select("id,account_name,account_number,beneficiary,is_active,sort_order").eq("event_id",r.id).order("sort_order");if(accountsError){setEventMessage("تعذر تحميل حسابات الفعالية: "+accountsError.message);return;}setEventAccountForms((accounts||[]).map((a:any)=>({id:a.id,account_name:a.account_name,account_number:a.account_number,beneficiary:a.beneficiary||"",is_active:a.is_active,sort_order:a.sort_order})));const {data,error}=await supabase.from("ticket_types").select("id,name,description,price,currency,quantity_total,quantity_sold,sales_start_at,sales_end_at,is_active").eq("event_id",r.id).order("created_at",{ascending:true});if(error){setEventMessage("تعذر تحميل أنواع التذاكر: "+error.message);return;}setTicketForms((data||[]).map((t:any)=>({id:t.id,name:t.name,description:t.description||"",price:String(t.price),currency:String(t.currency||"SDG").trim(),quantity_total:String(t.quantity_total),quantity_sold:Number(t.quantity_sold||0),sales_start_at:t.sales_start_at?new Date(new Date(t.sales_start_at).getTime()-new Date(t.sales_start_at).getTimezoneOffset()*60000).toISOString().slice(0,16):"",sales_end_at:t.sales_end_at?new Date(new Date(t.sales_end_at).getTime()-new Date(t.sales_end_at).getTimezoneOffset()*60000).toISOString().slice(0,16):"",is_active:t.is_active!==false})));if(!data?.length)setTicketForms([emptyTicket()]);})();
      setShowEventForm(true);setEventMessage("");window.scrollTo({top:0,behavior:"smooth"});
    };
  
    const createEvent = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !role || !["owner","admin"].includes(role)) return;
      setSavingEvent(true); setEventMessage("");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setEventMessage("انتهت الجلسة، سجل الدخول مرة أخرى."); setSavingEvent(false); return; }
      if(!eventForm.title.trim()||!eventForm.city.trim()||!eventForm.venue.trim()||!eventForm.starts_at){setEventMessage("أكمل اسم الفعالية والمدينة والمكان وموعد البداية.");setSavingEvent(false);return;}
      if(eventForm.ends_at&&new Date(eventForm.ends_at)<=new Date(eventForm.starts_at)){setEventMessage("موعد نهاية الفعالية لازم يكون بعد موعد البداية.");setSavingEvent(false);return;}
      if(eventAccountForms.some(a=>!a.account_name.trim()||!a.account_number.trim()||!a.beneficiary.trim())){setEventMessage("أكمل اسم ورقم كل حساب أو أزله من القائمة.");setSavingEvent(false);return;}
      if(!ticketForms.length||ticketForms.some(t=>!t.name.trim()||t.price===""||!t.quantity_total||!Number.isFinite(Number(t.price))||Number(t.price)<0||!Number.isInteger(Number(t.quantity_total))||Number(t.quantity_total)<Math.max(1,t.quantity_sold)||(t.sales_start_at&&t.sales_end_at&&new Date(t.sales_end_at)<=new Date(t.sales_start_at)))){setEventMessage("راجع فئات التذاكر: الاسم والسعر والكمية مطلوبة، والكمية لا تقل عن المباع، ونهاية البيع بعد بدايته.");setSavingEvent(false);return;}
      let coverUrl = eventForm.cover_image_url.trim() || null;
      if (coverFile) {
        if (!coverFile.type.startsWith("image/")) { setEventMessage("الملف المختار ليس صورة."); setSavingEvent(false); return; }
        if (coverFile.size > 10 * 1024 * 1024) { setEventMessage("حجم الصورة أكبر من 10 ميجابايت."); setSavingEvent(false); return; }
        const ext = (coverFile.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g,"") || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("event-covers").upload(path, coverFile, {contentType:coverFile.type,upsert:false,cacheControl:"31536000"});
        if (uploadError) { setEventMessage("تعذر رفع صورة الغلاف: "+uploadError.message); setSavingEvent(false); return; }
        coverUrl = supabase.storage.from("event-covers").getPublicUrl(path).data.publicUrl;
      }
      const eventPayload = {title:eventForm.title.trim(),description:eventForm.description.trim()||null,category:eventForm.category.trim()||null,city:eventForm.city.trim()||null,venue:eventForm.venue.trim()||null,address:eventForm.address.trim()||null,location_url:eventForm.location_url.trim()||null,starts_at:new Date(eventForm.starts_at).toISOString(),ends_at:eventForm.ends_at?new Date(eventForm.ends_at).toISOString():null,cover_image_url:coverUrl,is_trending:eventForm.is_trending,platform_fee_percent:Math.min(100,Math.max(0,Number(eventForm.platform_fee_percent)||0))};
      if(editingEventId){
        const {error:updateError}=await supabase.from("events").update(eventPayload).eq("id",editingEventId);
        if(updateError){setEventMessage("تعذر تحديث الفعالية: "+updateError.message);setSavingEvent(false);return;}
        const {data:existingTickets,error:existingError}=await supabase.from("ticket_types").select("id,quantity_sold").eq("event_id",editingEventId);
        if(existingError){setEventMessage("تم تحديث الفعالية لكن تعذر تحميل التذاكر: "+existingError.message);setSavingEvent(false);return;}
        const keptIds=ticketForms.map(t=>t.id).filter(Boolean) as string[];
        for(const t of ticketForms){
          if(!t.name.trim()||!t.quantity_total||Number(t.price)<0||Number(t.quantity_total)<t.quantity_sold){setEventMessage("راجع بيانات التذاكر: الكمية لا يمكن أن تقل عن المباع.");setSavingEvent(false);return;}
          const payload={name:t.name.trim(),description:t.description.trim()||null,price:Number(t.price),currency:t.currency,quantity_total:Number(t.quantity_total),sales_start_at:t.sales_start_at?new Date(t.sales_start_at).toISOString():null,sales_end_at:t.sales_end_at?new Date(t.sales_end_at).toISOString():null,is_active:t.is_active};
          const result=t.id?await supabase.from("ticket_types").update(payload).eq("id",t.id):await supabase.from("ticket_types").insert({...payload,event_id:editingEventId,quantity_sold:0});
          if(result.error){setEventMessage("تم تحديث بيانات الفعالية لكن تعذر حفظ التذاكر: "+result.error.message);setSavingEvent(false);return;}
        }
        for(const old of (existingTickets||[]).filter((t:any)=>!keptIds.includes(t.id))){
          if(Number(old.quantity_sold)>0){await supabase.from("ticket_types").update({is_active:false}).eq("id",old.id);continue;}
          const {count}=await supabase.from("booking_items").select("id",{count:"exact",head:true}).eq("ticket_type_id",old.id);
          if((count||0)>0) await supabase.from("ticket_types").update({is_active:false}).eq("id",old.id);
          else await supabase.from("ticket_types").delete().eq("id",old.id);
        }
        const {data:existingAccounts,error:existingAccountsError}=await supabase.from("event_payment_accounts").select("id").eq("event_id",editingEventId);
        if(existingAccountsError){setEventMessage("تم تحديث الفعالية لكن تعذر تحميل حساباتها الحالية: "+existingAccountsError.message);setSavingEvent(false);return;}
        const retainedAccountIds=eventAccountForms.map(a=>a.id).filter(Boolean) as string[];
        for(const oldAccount of (existingAccounts||[]).filter((a:any)=>!retainedAccountIds.includes(a.id))){
          const {error:deleteAccountError}=await supabase.from("event_payment_accounts").delete().eq("id",oldAccount.id).eq("event_id",editingEventId);
          if(deleteAccountError){setEventMessage("تم تحديث الفعالية لكن تعذر إزالة حساب دفع: "+deleteAccountError.message);setSavingEvent(false);return;}
        }
        for(let i=0;i<eventAccountForms.length;i++){
          const a=eventAccountForms[i];
          const accountPayload={account_name:a.account_name.trim(),account_number:a.account_number.trim(),beneficiary:a.beneficiary.trim(),is_active:a.is_active,sort_order:a.sort_order??(i+1)*10};
          const accountResult=a.id
            ? await supabase.from("event_payment_accounts").update(accountPayload).eq("id",a.id).eq("event_id",editingEventId)
            : await supabase.from("event_payment_accounts").insert({...accountPayload,event_id:editingEventId});
          if(accountResult.error){setEventMessage("تم تحديث الفعالية لكن تعذر حفظ حساباتها: "+accountResult.error.message);setSavingEvent(false);return;}
        }
        setEventMessage("تم تحديث الفعالية وجميع أنواع التذاكر وحسابات الدفع.");setEditingEventId(null);setEventForm(emptyEventForm);setTicketForms([emptyTicket()]);setEventAccountForms([]);setCoverFile(null);setCoverPreview("");setShowEventForm(false);setSavingEvent(false);await loadEvents();return;
      }
      const slug = eventForm.title.trim().toLowerCase().normalize("NFKD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^a-z0-9\\u0600-\\u06ff]+/g,"-").replace(/^-|-$/g,"") + "-" + Math.random().toString(36).slice(2,7);
      const { data: event, error: eventError } = await supabase.from("events").insert({...eventPayload,slug,status:"draft",created_by:user.id}).select("id").single();
      if (eventError || !event) { setEventMessage("تعذر إنشاء الفعالية: " + (eventError?.message || "خطأ غير معروف")); setSavingEvent(false); return; }
      const { error: ticketError } = await supabase.from("ticket_types").insert(ticketForms.map(t=>({event_id:event.id,name:t.name.trim(),description:t.description.trim()||null,price:Number(t.price),currency:t.currency,quantity_total:Number(t.quantity_total),quantity_sold:0,sales_start_at:t.sales_start_at?new Date(t.sales_start_at).toISOString():null,sales_end_at:t.sales_end_at?new Date(t.sales_end_at).toISOString():null,is_active:t.is_active})));
      if(!ticketError&&eventAccountForms.length){const {error:accountError}=await supabase.from("event_payment_accounts").insert(eventAccountForms.map((a,i)=>({event_id:event.id,account_name:a.account_name.trim(),account_number:a.account_number.trim(),beneficiary:a.beneficiary.trim(),is_active:a.is_active,sort_order:a.sort_order??(i+1)*10})));if(accountError){await supabase.from("events").delete().eq("id",event.id);setEventMessage("تعذر حفظ حسابات الدفع، وتم التراجع عن إنشاء الفعالية: "+accountError.message);setSavingEvent(false);return;}}
      if (ticketError) {
        await supabase.from("events").delete().eq("id",event.id);
        setEventMessage("لم يتم حفظ نوع التذكرة، وتم التراجع عن إنشاء الفعالية: " + ticketError.message);
        setSavingEvent(false); return;
      }
      setEventMessage("تم إنشاء الفعالية ونوع التذكرة كمسودة بنجاح.");
      setEditingEventId(null);setEventForm(emptyEventForm);setTicketForms([emptyTicket()]);setEventAccountForms([]);setCoverFile(null);setCoverPreview("");
      setShowEventForm(false); setSavingEvent(false); await loadEvents();
    };
  
  

  const eventCards = <div className="admin-event-cards">
        {rows.length===0?<p className="admin-no-data">لا توجد فعاليات حتى الآن. أضف أول فعالية من الزر بالأعلى.</p>:rows.map((r,i)=><article className="admin-event-card" key={r.id||i}>
          <div className="admin-event-card-main">
            <div className="admin-event-card-title"><h4>{r.title||"فعالية بدون عنوان"}</h4><span className={"admin-event-status status-"+(r.status||"draft")}>{statusLabels[r.status]||fmt(r.status)}</span></div>
            <div className="admin-event-card-meta"><span><b>التصنيف:</b> {fmt(r.category)}</span><span><b>المدينة:</b> {fmt(r.city)}</span><span><b>المكان:</b> {fmt(r.venue)}</span><span><b>الموعد:</b> {r.starts_at?new Date(r.starts_at).toLocaleString("ar-SD"):"—"}</span></div>
          </div>
          {(role==="owner"||role==="admin")&&<div className="admin-event-card-actions">
            <button className="admin-event-edit" type="button" disabled={loading} onClick={()=>editEvent(r)}>تعديل</button>
            <button className="admin-event-delete" type="button" disabled={sectionLoading} onClick={()=>void deleteEvent(r)}>حذف</button>
            {r.status==="draft"?<button className="admin-create-button" type="button" disabled={sectionLoading} onClick={()=>void publishEvent(r.id)}>نشر الفعالية</button>:null}
            {r.is_trending?<small>رائج الآن</small>:null}
          </div>}
        </article>)}
      </div>;;

  return <section className="admin-panel">
    <div className="admin-panel-head">
      <div><h3>الفعاليات</h3><p>إدارة دورة الفعالية: البيانات، التذاكر، حسابات الدفع والنشر</p></div>
      <div className="admin-panel-actions">
        {(role==="owner"||role==="admin")&&<button className="admin-create-button admin-event-add" type="button" onClick={()=>{setShowEventForm(v=>!v);setEditingEventId(null);setEventForm(emptyEventForm);setTicketForms([emptyTicket()]);setEventAccountForms([]);setEventMessage("");}}>{showEventForm?"إغلاق":"＋ إضافة فعالية"}</button>}
        <button className="admin-refresh" type="button" onClick={()=>void loadEvents()} disabled={loading}><RefreshCw size={16}/> تحديث</button>
      </div>
    </div>
    {eventMessage&&<p className="admin-form-message" role="status">{eventMessage}</p>}
    {showEventForm&&<form className="admin-event-form" onSubmit={createEvent}><h3>{editingEventId?"تعديل بيانات الفعالية":"بيانات الفعالية"}</h3><div className="admin-form-grid"><label>اسم الفعالية *<input required value={eventForm.title} onChange={e=>setEventForm({...eventForm,title:e.target.value})}/></label><label>المدينة *<input required value={eventForm.city} onChange={e=>setEventForm({...eventForm,city:e.target.value})}/></label><label>المكان *<input required value={eventForm.venue} onChange={e=>setEventForm({...eventForm,venue:e.target.value})}/></label><label>العنوان التفصيلي<input value={eventForm.address} onChange={e=>setEventForm({...eventForm,address:e.target.value})}/></label><label>رابط الموقع / Google Maps<input type="url" placeholder="https://maps.google.com/..." value={eventForm.location_url} onChange={e=>setEventForm({...eventForm,location_url:e.target.value})}/></label><label className="admin-form-wide">صورة الغلاف (من جهازك)<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0]||null;setCoverFile(file);if(file){const url=URL.createObjectURL(file);setCoverPreview(url);}else{setCoverPreview(eventForm.cover_image_url);}}}/><small className="admin-form-hint">الصيغ المدعومة حسب المتصفح · الحد الأقصى 10 MB · تُرفع الصورة الأصلية دون ضغط.</small></label>{coverPreview&&<div className="admin-cover-preview"><img src={coverPreview} alt="معاينة صورة الغلاف"/><button type="button" onClick={()=>{setCoverFile(null);setCoverPreview("");setEventForm({...eventForm,cover_image_url:""});}}>إزالة الصورة</button></div>}<label>الزمان / تاريخ ووقت البداية *<input type="datetime-local" required value={eventForm.starts_at} onChange={e=>setEventForm({...eventForm,starts_at:e.target.value})}/></label><label>تاريخ ووقت النهاية<input type="datetime-local" value={eventForm.ends_at} onChange={e=>setEventForm({...eventForm,ends_at:e.target.value})}/></label></div><label>نسبة عمولة المنصة (%) *<input type="number" min="0" max="100" step="0.01" required value={eventForm.platform_fee_percent} onChange={e=>setEventForm({...eventForm,platform_fee_percent:e.target.value})}/><small className="admin-form-hint">تُستخدم لحساب صافي عمولة حاضر في الإحصائيات.</small></label><label className="admin-form-wide">عن الفعالية<textarea rows={3} value={eventForm.description} onChange={e=>setEventForm({...eventForm,description:e.target.value})}/></label><label className="admin-trending-check"><input type="checkbox" checked={eventForm.is_trending} onChange={e=>setEventForm({...eventForm,is_trending:e.target.checked})}/> إظهار الفعالية في «رائج الآن»</label><section className="admin-ticket-editor"><div className="admin-ticket-heading"><h3>حسابات التحويل الخاصة بالفعالية</h3><button type="button" className="admin-create-button" onClick={()=>setEventAccountForms(v=>[...v,{account_name:"",account_number:"",beneficiary:"",is_active:true,sort_order:(v.length+1)*10}])}>＋ إضافة حساب</button></div>{eventAccountForms.map((a,i)=><div className="admin-ticket-row" key={a.id||"event-account-"+i}><div className="admin-form-grid"><label>اسم البنك أو طريقة الدفع *<input value={a.account_name} onChange={e=>setEventAccountForms(v=>v.map((x,j)=>j===i?{...x,account_name:e.target.value}:x))}/></label><label>رقم الحساب *<input dir="ltr" value={a.account_number} onChange={e=>setEventAccountForms(v=>v.map((x,j)=>j===i?{...x,account_number:e.target.value}:x))}/></label><label>اسم المستفيد *<input value={a.beneficiary} onChange={e=>setEventAccountForms(v=>v.map((x,j)=>j===i?{...x,beneficiary:e.target.value}:x))}/></label><label className="admin-trending-check"><input type="checkbox" checked={a.is_active} onChange={e=>setEventAccountForms(v=>v.map((x,j)=>j===i?{...x,is_active:e.target.checked}:x))}/> متاح للحجز</label><button type="button" className="admin-delete-button" onClick={()=>setEventAccountForms(v=>v.filter((_,j)=>j!==i))}>إزالة الحساب</button></div></div>)}</section><div className="admin-ticket-editor"><div className="admin-ticket-heading"><h3>أنواع التذاكر</h3><button type="button" className="admin-create-button" onClick={()=>setTicketForms(v=>[...v,emptyTicket()])}>＋ إضافة فئة تذكرة</button></div>{ticketForms.map((t,i)=><div className="admin-ticket-row" key={t.id||"new-"+i}><div className="admin-ticket-row-head"><b>الفئة {i+1}</b>{ticketForms.length>1&&<button type="button" className="admin-delete-button" onClick={()=>setTicketForms(v=>v.filter((_,j)=>j!==i))}>إزالة</button>}</div><div className="admin-form-grid"><label>اسم التذكرة *<input required value={t.name} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,name:e.target.value}:x))}/></label><label>الوصف (اختياري)<input value={t.description} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,description:e.target.value}:x))}/></label><label>السعر *<input type="number" min="0" step="0.01" required value={t.price} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,price:e.target.value}:x))}/></label><label>العملة<select value={t.currency} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,currency:e.target.value}:x))}><option value="SDG">جنيه سوداني (SDG)</option><option value="SAR">ريال سعودي (SAR)</option><option value="AED">درهم إماراتي (AED)</option><option value="USD">دولار أمريكي (USD)</option><option value="EGP">جنيه مصري (EGP)</option></select></label><label>الكمية المتاحة *<input type="number" min={t.quantity_sold||1} step="1" required value={t.quantity_total} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,quantity_total:e.target.value}:x))}/></label><label>بداية البيع<input type="datetime-local" value={t.sales_start_at} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,sales_start_at:e.target.value}:x))}/></label><label>نهاية البيع<input type="datetime-local" value={t.sales_end_at} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,sales_end_at:e.target.value}:x))}/></label><label className="admin-trending-check"><input type="checkbox" checked={t.is_active} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,is_active:e.target.checked}:x))}/> الفئة مفعّلة للحجز</label>{t.quantity_sold>0&&<small className="admin-form-hint">تم بيع {t.quantity_sold} — لا يمكن تقليل الكمية عنها.</small>}</div></div>)}</div><p className="admin-form-hint">سيتم حفظ الفعالية كمسودة، ولن تظهر للجمهور إلا بعد نشرها.</p>{eventMessage&&<p className="admin-form-message" role="status">{eventMessage}</p>}<button className="admin-create-button" type="submit" disabled={savingEvent}>{savingEvent?"جاري الحفظ...":editingEventId?"حفظ التعديلات":"حفظ الفعالية"}</button></form>}
    {loading?<p className="admin-no-data">جاري تحميل البيانات...</p>:eventCards}
  </section>;
}
