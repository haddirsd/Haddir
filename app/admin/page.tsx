"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import { Activity, ArrowRight, BadgeCheck, Banknote, CalendarDays, ClipboardCheck, LayoutDashboard, LogOut, Shield, Ticket, Users, Wallet, RefreshCw } from "lucide-react";

type AdminRole = "owner" | "admin" | "supervisor";
type Section = "overview" | "events" | "bookings" | "payments" | "users" | "reports";
type Row = Record<string, any>;
type PaymentMethodRow={id:string;name:string;account_details:string;beneficiary:string;instructions:string;is_active:boolean;sort_order:number};
const labels: Record<Section, string> = { overview: "نظرة عامة", events: "الفعاليات", bookings: "الحجوزات", payments: "مراجعة المدفوعات", users: "المستخدمون", reports: "التقارير" };
const statusLabels: Record<string, string> = { draft:"مسودة", published:"منشورة", cancelled:"ملغاة", completed:"مكتملة", pending_payment:"بانتظار الدفع", under_review:"قيد المراجعة", confirmed:"مؤكد", rejected:"مرفوض", expired:"منتهي", submitted:"بانتظار المراجعة", approved:"مقبول", valid:"صالح", used:"مستخدم" };
const fmt = (v: unknown) => v == null || v === "" ? "—" : String(v);
const money = (v: unknown, currency = "SDG") => v == null ? "—" : `${Number(v).toLocaleString("ar-SD")} ${currency}`;

export default function AdminPage() {
  const router = useRouter();
  const [role, setRole] = useState<AdminRole | null>(null);
  const [name, setName] = useState("");
  const [section, setSection] = useState<Section>("overview");
  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState({ events: 0, bookings: 0, pending: 0, users: 0, confirmed: 0, revenue: 0 });
  const [dataReady, setDataReady] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventMessage, setEventMessage] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const emptyEventForm = {title:"",description:"",category:"",city:"",venue:"",address:"",location_url:"",starts_at:"",ends_at:"",cover_image_url:"",is_trending:false};
  type TicketForm = {id?:string;name:string;description:string;price:string;currency:string;quantity_total:string;quantity_sold:number;sales_start_at:string;sales_end_at:string;is_active:boolean};
  const emptyTicket = ():TicketForm => ({name:"تذكرة عامة",description:"",price:"",currency:"SDG",quantity_total:"",quantity_sold:0,sales_start_at:"",sales_end_at:"",is_active:true});
  const [ticketForms,setTicketForms] = useState<TicketForm[]>([emptyTicket()]);
  type EventAccountForm={id?:string;account_name:string;account_number:string;beneficiary:string;is_active:boolean;sort_order:number};
  const [eventAccountForms,setEventAccountForms]=useState<EventAccountForm[]>([]);
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [paymentMethodRows,setPaymentMethodRows]=useState<PaymentMethodRow[]>([]);
  const [paymentMethodMessage,setPaymentMethodMessage]=useState("");
  const [paymentMethodSaving,setPaymentMethodSaving]=useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError("إعدادات الاتصال بقاعدة البيانات غير مكتملة."); setLoading(false); return; }
    let alive = true;
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role,full_name").eq("id", user.id).maybeSingle();
      if (!alive) return;
      if (profileError || !profile || !["owner", "admin", "supervisor"].includes(profile.role)) {
        setError("ليس لديك صلاحية الوصول إلى لوحة الإدارة."); setLoading(false); return;
      }
      setRole(profile.role as AdminRole);
      setName(profile.full_name || user.email || "فريق حاضر");
      setLoading(false);
      const [events, bookings, pending, users, confirmed] = await Promise.all([
        profile.role === "supervisor" ? Promise.resolve({count:null,error:null}) : supabase.from("events").select("id",{count:"exact",head:true}),
        supabase.from("bookings").select("id",{count:"exact",head:true}),
        supabase.from("payment_submissions").select("id",{count:"exact",head:true}).eq("status","submitted"),
        profile.role === "owner" || profile.role === "admin" ? supabase.from("profiles").select("id",{count:"exact",head:true}) : Promise.resolve({count:null,error:null}),
        supabase.from("bookings").select("subtotal").eq("status","confirmed")
      ]);
      if (!alive) return;
      const failed = [events,bookings,pending,users,confirmed].some(x => x.error);
      setCounts({events:events.count||0,bookings:bookings.count||0,pending:pending.count||0,users:users.count||0,confirmed:confirmed.data?.length||0,revenue:(confirmed.data||[]).reduce((s:any,x:any)=>s+Number(x.subtotal||0),0)});
      setDataReady(!failed);
      if (failed) setError("تعذر تحميل بعض مؤشرات الإدارة. تحقق من سياسات قاعدة البيانات.");
    };
    void init();
    return () => { alive = false; };
  }, [router]);

  const loadPaymentMethods=async()=>{
    const supabase=getSupabaseBrowserClient();if(!supabase)return;
    const {data,error}=await supabase.from("payment_methods").select("id,name,account_details,beneficiary,instructions,is_active,sort_order").order("sort_order");
    if(error){setPaymentMethodMessage("تعذر تحميل وسائل الدفع: "+error.message);return;}
    setPaymentMethodRows((data||[]) as PaymentMethodRow[]);
  };
  useEffect(()=>{if(role)void loadPaymentMethods();},[role]);
  const savePaymentMethod=async(method:PaymentMethodRow)=>{
    const supabase=getSupabaseBrowserClient();if(!supabase||!role||!["owner","admin"].includes(role))return;
    if(!method.id.trim()||!method.name.trim()||!method.account_details.trim()||!method.beneficiary.trim()){setPaymentMethodMessage("أكمل الاسم وبيانات الحساب واسم المستفيد.");return;}
    setPaymentMethodSaving(true);setPaymentMethodMessage("");
    const {error}=await supabase.from("payment_methods").upsert({...method,id:method.id.trim(),name:method.name.trim(),account_details:method.account_details.trim(),beneficiary:method.beneficiary.trim(),instructions:method.instructions.trim()||null,updated_at:new Date().toISOString()});
    setPaymentMethodSaving(false);
    if(error){setPaymentMethodMessage("تعذر حفظ وسيلة الدفع: "+error.message);return;}
    setPaymentMethodMessage("تم حفظ وسيلة الدفع.");await loadPaymentMethods();
  };
  const addPaymentMethod=()=>setPaymentMethodRows(v=>[...v,{id:"",name:"",account_details:"",beneficiary:"",instructions:"",is_active:false,sort_order:(v.length+1)*10}]);
  const deletePaymentMethod=async(id:string)=>{
    if(!window.confirm("حذف وسيلة الدفع؟"))return;
    const supabase=getSupabaseBrowserClient();if(!supabase)return;
    const {error}=await supabase.from("payment_methods").delete().eq("id",id);
    if(error){setPaymentMethodMessage("تعذر حذف وسيلة الدفع: "+error.message);return;}
    setPaymentMethodMessage("تم حذف وسيلة الدفع.");await loadPaymentMethods();
  };

  const nav = useMemo(() => role === "supervisor" ? (["overview","bookings","payments"] as Section[]) : (["overview","events","bookings","payments","users","reports"] as Section[]), [role]);

  const loadSection = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !role || section === "overview") return;
    setSectionLoading(true); setError(""); setRows([]);
    let result: {data:any[]|null,error:any} = {data:[],error:null};
    if (section === "events") result = await supabase.from("events").select("id,title,category,city,venue,starts_at,status,created_at,is_trending,description,address,location_url,ends_at,cover_image_url").order("created_at",{ascending:false}).limit(100);
    if (section === "bookings") result = await supabase.from("bookings").select("id,booking_number,customer_name,customer_email,customer_phone,event_id,subtotal,currency,status,expires_at,created_at,events(title),booking_items(quantity,unit_price,line_total,ticket_types(name)),payment_submissions(payment_account_name,payment_account_number,transfer_reference,created_at)").order("created_at",{ascending:false}).limit(100);
    if (section === "payments") result = await supabase.from("payment_submissions").select("id,booking_id,transfer_reference,receipt_path,amount,currency,status,review_note,created_at,bookings(booking_number,customer_name,customer_phone,subtotal)").order("created_at",{ascending:false}).limit(100);
    if (section === "users" && role !== "supervisor") result = await supabase.from("profiles").select("id,full_name,phone,role,created_at").order("created_at",{ascending:false}).limit(100);
    if (section === "reports" && role !== "supervisor") result = await supabase.from("bookings").select("subtotal,currency,status,created_at").order("created_at",{ascending:false}).limit(500);
    if (result.error) { setSectionLoading(false);setError("تعذر تحميل بيانات هذا القسم: " + result.error.message); return; }
    let loadedRows=result.data||[];
    if(section==="payments"){
      loadedRows=await Promise.all(loadedRows.map(async(row:any)=>{
        if(!row.receipt_path)return row;
        const {data}=await supabase.storage.from("payment-receipts").createSignedUrl(row.receipt_path,900);
        return {...row,receipt_url:data?.signedUrl||null};
      }));
    }
    setSectionLoading(false);
    setRows(loadedRows);
  };

  useEffect(() => { void loadSection(); }, [section, role]);

  useEffect(() => {
    const supabase=getSupabaseBrowserClient();
    if(!supabase||section!=="bookings"||!role)return;
    const channel=supabase.channel("admin-live-bookings")
      .on("postgres_changes",{event:"*",schema:"public",table:"bookings"},()=>{void loadSection();})
      .on("postgres_changes",{event:"*",schema:"public",table:"booking_items"},()=>{void loadSection();})
      .on("postgres_changes",{event:"*",schema:"public",table:"payment_submissions"},()=>{void loadSection();})
      .subscribe();
    return()=>{void supabase.removeChannel(channel);};
  },[section,role]);

  const reviewPayment=async(row:Row,decision:"approve"|"reject")=>{
    const supabase=getSupabaseBrowserClient();if(!supabase||!role)return;
    const reason=decision==="reject"?window.prompt("اكتب سبب رفض إثبات الدفع ليظهر للعميل في الإشعارات:",""):null;
    if(decision==="reject"&&!reason?.trim())return;
    if(decision==="approve"&&!window.confirm("تأكيد قبول الدفع وإصدار تذاكر برموز دخول من 10 أرقام؟"))return;
    setSectionLoading(true);setError("");
    const {data,error}=await supabase.rpc("review_payment_submission",{p_submission_id:row.id,p_decision:decision,p_rejection_reason:reason?.trim()||null});
    setSectionLoading(false);
    if(error){setError("تعذرت مراجعة إثبات الدفع: "+error.message);return;}
    setEventMessage(decision==="approve"?("تم اعتماد الدفع وإصدار "+Number(data?.tickets_created||0)+" تذكرة."):"تم رفض إثبات الدفع وإرسال السبب للعميل.");
    await loadSection();
  };

  const deleteEvent = async (r:Row) => {
    const supabase=getSupabaseBrowserClient();if(!supabase||!role||!["owner","admin"].includes(role))return;
    if(!window.confirm("حذف الفعالية «"+r.title+"»؟ إذا كانت مرتبطة بحجوزات أو تذاكر صادرة فسيتم إلغاؤها وإخفاؤها مع الاحتفاظ بالسجلات المالية والتذاكر السابقة."))return;
    setSectionLoading(true);
    const [{count:bookings},{count:tickets}] = await Promise.all([
      supabase.from("bookings").select("id",{count:"exact",head:true}).eq("event_id",r.id),
      supabase.from("tickets").select("id",{count:"exact",head:true}).eq("event_id",r.id)
    ]);
    if((bookings||0)>0||(tickets||0)>0){
      const {error}=await supabase.from("events").update({status:"cancelled",is_trending:false}).eq("id",r.id);
      if(!error) await supabase.from("ticket_types").update({is_active:false}).eq("event_id",r.id);
      setSectionLoading(false);if(error){setError("تعذر إلغاء الفعالية: "+error.message);return;}
      setEventMessage("الفعالية مرتبطة بحجوزات/تذاكر؛ ألغيناها وأخفيناها مع الاحتفاظ بالسجلات.");await loadSection();return;
    }
    const {error}=await supabase.from("events").delete().eq("id",r.id);
    setSectionLoading(false);if(error){setError("تعذر حذف الفعالية: "+error.message);return;}
    setEventMessage("تم حذف الفعالية نهائياً.");await loadSection();
  };

  const publishEvent = async (eventId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !role || !["owner","admin"].includes(role)) return;
    const confirmed = window.confirm("هل تريد نشر هذه الفعالية الآن؟ ستصبح ظاهرة للزوار.");
    if (!confirmed) return;
    setSectionLoading(true);
    const { error } = await supabase.from("events").update({ status: "published" }).eq("id", eventId).eq("status", "draft");
    setSectionLoading(false);
    if (error) { setError("تعذر نشر الفعالية: " + error.message); return; }
    setEventMessage("تم إرسال طلب النشر بنجاح.");
    await loadSection();
  };

  const editEvent = (r: Row) => {
    setEditingEventId(r.id);
    const localDate=(v:string|null)=>v?new Date(new Date(v).getTime()-new Date(v).getTimezoneOffset()*60000).toISOString().slice(0,16):"";
    setEventForm({...emptyEventForm,title:r.title||"",description:r.description||"",category:r.category||"",city:r.city||"",venue:r.venue||"",address:r.address||"",location_url:r.location_url||"",starts_at:localDate(r.starts_at),ends_at:localDate(r.ends_at),cover_image_url:r.cover_image_url||"",is_trending:!!r.is_trending});
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
    const eventPayload = {title:eventForm.title.trim(),description:eventForm.description.trim()||null,category:eventForm.category.trim()||null,city:eventForm.city.trim()||null,venue:eventForm.venue.trim()||null,address:eventForm.address.trim()||null,location_url:eventForm.location_url.trim()||null,starts_at:new Date(eventForm.starts_at).toISOString(),ends_at:eventForm.ends_at?new Date(eventForm.ends_at).toISOString():null,cover_image_url:coverUrl,is_trending:eventForm.is_trending};
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
      const {error:clearAccountsError}=await supabase.from("event_payment_accounts").delete().eq("event_id",editingEventId);if(clearAccountsError){setEventMessage("تم تحديث الفعالية لكن تعذر تحديث حساباتها: "+clearAccountsError.message);setSavingEvent(false);return;}if(eventAccountForms.length){const {error:accountSaveError}=await supabase.from("event_payment_accounts").insert(eventAccountForms.map((a,i)=>({event_id:editingEventId,account_name:a.account_name.trim(),account_number:a.account_number.trim(),beneficiary:a.beneficiary.trim(),is_active:a.is_active,sort_order:a.sort_order??(i+1)*10})));if(accountSaveError){setEventMessage("تم تحديث الفعالية لكن تعذر حفظ حساباتها: "+accountSaveError.message);setSavingEvent(false);return;}}
      setEventMessage("تم تحديث الفعالية وجميع أنواع التذاكر وحسابات الدفع.");setEditingEventId(null);setEventForm(emptyEventForm);setTicketForms([emptyTicket()]);setEventAccountForms([]);setCoverFile(null);setCoverPreview("");setShowEventForm(false);setSavingEvent(false);await loadSection();return;
    }
    const slug = eventForm.title.trim().toLowerCase().normalize("NFKD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^a-z0-9\\u0600-\\u06ff]+/g,"-").replace(/^-|-$/g,"") + "-" + Math.random().toString(36).slice(2,7);
    const { data: event, error: eventError } = await supabase.from("events").insert({...eventPayload,slug,status:"draft",created_by:user.id}).select("id").single();
    if (eventError || !event) { setEventMessage("تعذر إنشاء الفعالية: " + (eventError?.message || "خطأ غير معروف")); setSavingEvent(false); return; }
    const { error: ticketError } = await supabase.from("ticket_types").insert(ticketForms.map(t=>({event_id:event.id,name:t.name.trim(),description:t.description.trim()||null,price:Number(t.price),currency:t.currency,quantity_total:Number(t.quantity_total),quantity_sold:0,sales_start_at:t.sales_start_at?new Date(t.sales_start_at).toISOString():null,sales_end_at:t.sales_end_at?new Date(t.sales_end_at).toISOString():null,is_active:t.is_active})));
    if(!ticketError&&eventAccountForms.length){const {error:accountError}=await supabase.from("event_payment_accounts").insert(eventAccountForms.map((a,i)=>({event_id:event.id,account_name:a.account_name.trim(),account_number:a.account_number.trim(),is_active:a.is_active,sort_order:a.sort_order??(i+1)*10})));if(accountError){await supabase.from("events").delete().eq("id",event.id);setEventMessage("تعذر حفظ حسابات الدفع، وتم التراجع عن إنشاء الفعالية: "+accountError.message);setSavingEvent(false);return;}}
    if (ticketError) {
      await supabase.from("events").delete().eq("id",event.id);
      setEventMessage("لم يتم حفظ نوع التذكرة، وتم التراجع عن إنشاء الفعالية: " + ticketError.message);
      setSavingEvent(false); return;
    }
    setEventMessage("تم إنشاء الفعالية ونوع التذكرة كمسودة بنجاح.");
    setEditingEventId(null);setEventForm(emptyEventForm);setTicketForms([emptyTicket()]);setEventAccountForms([]);setCoverFile(null);setCoverPreview("");
    setShowEventForm(false); setSavingEvent(false); await loadSection();
  };

  const signOut = async () => { const supabase = getSupabaseBrowserClient(); if (supabase) await supabase.auth.signOut(); router.replace("/"); };

  if (loading) return <main className="admin-loading" dir="rtl"><div className="admin-spinner"/><p>جاري التحقق من صلاحياتك...</p></main>;
  if (!role) return <main className="admin-denied" dir="rtl"><Shield size={34}/><h1>الوصول غير متاح</h1><p>{error || "هذه الصفحة مخصصة لفريق إدارة حاضر."}</p><button onClick={() => router.replace("/")}>العودة للرئيسية</button></main>;

  const supervisor = role === "supervisor";
  const roleLabel = role === "owner" ? "مالك المنصة" : role === "admin" ? "مدير الإدارة" : "المشرف الإداري";
  const metrics = supervisor
    ? [{title:"إثباتات بانتظار المراجعة",value:counts.pending,icon:ClipboardCheck},{title:"الحجوزات",value:counts.bookings,icon:Ticket}]
    : [{title:"الفعاليات",value:counts.events,icon:CalendarDays},{title:"الحجوزات",value:counts.bookings,icon:Ticket},{title:"إثباتات بانتظار المراجعة",value:counts.pending,icon:ClipboardCheck},{title:"حسابات المستخدمين",value:counts.users,icon:Users}];

  const renderRows = () => {
    if (section === "reports") {
      const confirmed = rows.filter(x=>x.status==="confirmed");
      const total = confirmed.reduce((s,x)=>s+Number(x.subtotal||0),0);
      return <div className="admin-metric-grid">
        {[{title:"إجمالي الحجوزات",value:rows.length},{title:"الحجوزات المؤكدة",value:confirmed.length},{title:"إجمالي المبيعات المؤكدة",value:money(total,confirmed[0]?.currency||"SDG")}].map(x=><article className="admin-metric" key={x.title}><small>{x.title}</small><strong>{typeof x.value==="number"?x.value.toLocaleString("ar-SD"):x.value}</strong></article>)}
      </div>;
    }
    const columns: Record<string,{key:string,label:string,format?:(r:Row)=>string}[]> = {
      events:[{key:"title",label:"الفعالية"},{key:"category",label:"التصنيف"},{key:"city",label:"المدينة"},{key:"venue",label:"الموقع"},{key:"starts_at",label:"الموعد",format:r=>r.starts_at?new Date(r.starts_at).toLocaleString("ar-SD"):"—"},{key:"status",label:"الحالة",format:r=>statusLabels[r.status]||fmt(r.status)}],
      bookings:[{key:"booking_number",label:"رقم الحجز"},{key:"event",label:"الفعالية",format:r=>r.events?.title||"—"},{key:"ticket",label:"التذكرة / العدد",format:r=>(r.booking_items||[]).map((x:any)=>`${x.ticket_types?.name||"تذكرة"} × ${x.quantity}`).join("، ")||"—"},{key:"customer_name",label:"الزبون"},{key:"customer_phone",label:"الهاتف"},{key:"subtotal",label:"المبلغ",format:r=>money(r.subtotal,r.currency)},{key:"payment_account",label:"حساب التحويل",format:r=>{const p=(r.payment_submissions||[]).find((x:any)=>x.payment_account_name||x.payment_account_number);return p?`${p.payment_account_name||"—"} — ${p.payment_account_number||"—"}`:"لم يُرسل إثبات دفع بعد";}},{key:"transfer_reference",label:"مرجع التحويل",format:r=>(r.payment_submissions||[]).find((x:any)=>x.transfer_reference)?.transfer_reference||"—"},{key:"status",label:"الحالة",format:r=>statusLabels[r.status]||fmt(r.status)},{key:"created_at",label:"التاريخ",format:r=>new Date(r.created_at).toLocaleDateString("ar-SD")}],
      payments:[{key:"booking",label:"الحجز",format:r=>r.bookings?.booking_number||r.booking_id},{key:"customer",label:"الزبون",format:r=>r.bookings?.customer_name||"—"},{key:"transfer_reference",label:"مرجع التحويل"},{key:"receipt_url",label:"الإيصال",format:r=>r.receipt_url?"متاح":"—"},{key:"amount",label:"المبلغ",format:r=>money(r.amount,r.currency)},{key:"status",label:"الحالة",format:r=>statusLabels[r.status]||fmt(r.status)},{key:"review_note",label:"ملاحظة المراجعة"},{key:"created_at",label:"التاريخ",format:r=>new Date(r.created_at).toLocaleDateString("ar-SD")}],
      users:[{key:"full_name",label:"الاسم"},{key:"phone",label:"الهاتف"},{key:"role",label:"الدور"},{key:"created_at",label:"تاريخ التسجيل",format:r=>new Date(r.created_at).toLocaleDateString("ar-SD")}]
    };
    const cols=columns[section]||[];
    if(section==="events"){
      return <div className="admin-event-cards">
        {rows.length===0?<p className="admin-no-data">لا توجد فعاليات حتى الآن. أضف أول فعالية من الزر بالأعلى.</p>:rows.map((r,i)=><article className="admin-event-card" key={r.id||i}>
          <div className="admin-event-card-main">
            <div className="admin-event-card-title"><h4>{r.title||"فعالية بدون عنوان"}</h4><span className={"admin-event-status status-"+(r.status||"draft")}>{statusLabels[r.status]||fmt(r.status)}</span></div>
            <div className="admin-event-card-meta"><span><b>التصنيف:</b> {fmt(r.category)}</span><span><b>المدينة:</b> {fmt(r.city)}</span><span><b>المكان:</b> {fmt(r.venue)}</span><span><b>الموعد:</b> {r.starts_at?new Date(r.starts_at).toLocaleString("ar-SD"):"—"}</span></div>
          </div>
          {(role==="owner"||role==="admin")&&<div className="admin-event-card-actions">
            <button className="admin-event-edit" type="button" disabled={sectionLoading} onClick={()=>editEvent(r)}>تعديل</button>
            <button className="admin-event-delete" type="button" disabled={sectionLoading} onClick={()=>void deleteEvent(r)}>حذف</button>
            {r.status==="draft"?<button className="admin-create-button" type="button" disabled={sectionLoading} onClick={()=>void publishEvent(r.id)}>نشر الفعالية</button>:null}
            {r.is_trending?<small>رائج الآن</small>:null}
          </div>}
        </article>)}
      </div>;
    }
    return <div className="admin-table-wrap"><table className="admin-data-table"><thead><tr>{cols.map(c=><th key={c.key}>{c.label}</th>)}{section==="payments"&&<th>قرار المراجعة</th>}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}>{cols.map(c=><td key={c.key}>{section==="payments"&&c.key==="receipt_url"&&r.receipt_url?<a className="admin-create-button" href={r.receipt_url} target="_blank" rel="noreferrer">عرض الإيصال</a>:c.format?c.format(r):fmt(r[c.key])}</td>)}{section==="payments"&&<td>{r.status==="submitted"?<><button className="admin-create-button" type="button" disabled={sectionLoading||!r.receipt_url} onClick={()=>void reviewPayment(r,"approve")}>قبول وإصدار التذاكر</button> <button className="admin-delete-button" type="button" disabled={sectionLoading} onClick={()=>void reviewPayment(r,"reject")}>رفض</button></>:<span>{statusLabels[r.status]||fmt(r.status)}</span>}</td>}</tr>)}</tbody></table>{rows.length===0&&<p className="admin-no-data">لا توجد سجلات حتى الآن.</p>}</div>;
  };

  return <main className="admin-shell" dir="rtl">
    <aside className="admin-sidebar">
      <button className="admin-brand" onClick={() => router.push("/")}><span>ح</span><b>حاضر</b><small>الإدارة</small></button>
      <div className="admin-side-caption">مساحة العمل</div>
      <nav>{nav.map(item=><button key={item} className={section===item?"active":""} onClick={()=>setSection(item)}><span>{item==="overview"?<LayoutDashboard/>:item==="events"?<CalendarDays/>:item==="bookings"?<Ticket/>:item==="payments"?<Banknote/>:item==="users"?<Users/>:<Activity/>}</span>{labels[item]}</button>)}</nav>
      <div className="admin-side-bottom"><div className="admin-mini-profile"><span>{role==="owner"?<Shield/>:role==="admin"?<BadgeCheck/>:<ClipboardCheck/>}</span><div><b>{name}</b><small>{roleLabel}</small></div></div><button className="admin-logout" onClick={signOut}><LogOut size={17}/> تسجيل الخروج</button></div>
    </aside>
    <section className="admin-main">
      <header className="admin-topbar"><div><span>حاضر / لوحة الإدارة</span><h1>{labels[section]}</h1></div><div className="admin-top-user"><span>{roleLabel}</span><span className="admin-avatar">{name.slice(0,1)}</span></div></header>
      <div className="admin-content">
        <div className="admin-welcome"><div><span className="admin-eyebrow">لوحة التحكم</span><h2>مرحباً، {name}</h2><p>{supervisor?"راجع الحجوزات وإثباتات التحويل.":"تابع أداء منصة حاضر وأدر عملياتها من مكان واحد."}</p></div><div className="admin-welcome-mark"><LayoutDashboard size={30}/></div></div>
        {error&&<div className="admin-notice" role="status">{error}</div>}
        {section==="overview"&&<><div className="admin-metric-grid">{metrics.map(m=><article className="admin-metric" key={m.title}><span><m.icon size={20}/></span><small>{m.title}</small><strong>{dataReady?m.value.toLocaleString("ar-SD"):"—"}</strong></article>)}</div><div className="admin-panel"><div className="admin-panel-head"><div><h3>{supervisor?"المهام اليومية":"نظرة سريعة"}</h3><p>بيانات مباشرة من قاعدة بيانات حاضر</p></div></div><div className="admin-shortcuts">{(supervisor?["bookings","payments"] as Section[]:["events","bookings","payments","users","reports"] as Section[]).map(item=><button key={item} onClick={()=>setSection(item)}><span>{item==="events"?<CalendarDays/>:item==="bookings"?<Ticket/>:item==="payments"?<Wallet/>:item==="users"?<Users/>:<Activity/>}</span><b>{labels[item]}</b><ArrowRight size={16}/></button>)}</div></div></>}
        {section!=="overview"&&<div className="admin-panel"><div className="admin-panel-head"><div><h3>{labels[section]}</h3><p>{section==="events"?"إدارة الفعاليات في بطاقات مرتبة":"السجلات الفعلية المحفوظة في قاعدة البيانات"}</p></div><div className="admin-panel-actions">{section==="events"&&(role==="owner"||role==="admin")&&<button className="admin-create-button admin-event-add" onClick={()=>{setShowEventForm(v=>!v);setEditingEventId(null);setEventForm(emptyEventForm);setTicketForms([emptyTicket()]);setEventAccountForms([]);setEventMessage("");}}>{showEventForm?"إغلاق":"＋ إضافة فعالية"}</button>}<button className="admin-refresh" onClick={()=>void loadSection()} disabled={sectionLoading}><RefreshCw size={16}/> تحديث</button></div></div>{section==="payments"&&<section className="admin-event-form"><div className="admin-panel-head"><div><h3>وسائل الدفع</h3><p>الوسائل الظاهرة للزوار في شاشة إتمام الحجز</p></div>{(role==="owner"||role==="admin")&&<button className="admin-create-button" type="button" onClick={addPaymentMethod}>＋ إضافة وسيلة</button>}</div>{paymentMethodRows.map((method,index)=><div className="admin-ticket-row" key={method.id||"new-"+index}><div className="admin-form-grid"><label>المعرّف (إنجليزي)<input disabled={!!(method.id&&paymentMethodRows.some((x,j)=>j!==index&&x.id===method.id))} value={method.id} onChange={e=>setPaymentMethodRows(v=>v.map((x,j)=>j===index?{...x,id:e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,"")}:x))}/></label><label>اسم وسيلة الدفع<input value={method.name} onChange={e=>setPaymentMethodRows(v=>v.map((x,j)=>j===index?{...x,name:e.target.value}:x))}/></label><label>رقم الحساب / بيانات التحويل<input value={method.account_details} onChange={e=>setPaymentMethodRows(v=>v.map((x,j)=>j===index?{...x,account_details:e.target.value}:x))}/></label><label>اسم المستفيد<input value={method.beneficiary} onChange={e=>setPaymentMethodRows(v=>v.map((x,j)=>j===index?{...x,beneficiary:e.target.value}:x))}/></label><label className="admin-form-wide">تعليمات للعميل<textarea rows={2} value={method.instructions||""} onChange={e=>setPaymentMethodRows(v=>v.map((x,j)=>j===index?{...x,instructions:e.target.value}:x))}/></label><label>ترتيب الظهور<input type="number" value={method.sort_order} onChange={e=>setPaymentMethodRows(v=>v.map((x,j)=>j===index?{...x,sort_order:Number(e.target.value)}:x))}/></label><label className="admin-trending-check"><input type="checkbox" checked={method.is_active} onChange={e=>setPaymentMethodRows(v=>v.map((x,j)=>j===index?{...x,is_active:e.target.checked}:x))}/> مفعّلة للزوار</label></div><div className="admin-panel-actions"><button className="admin-create-button" type="button" disabled={paymentMethodSaving} onClick={()=>void savePaymentMethod(method)}>حفظ الوسيلة</button>{method.id&&<button className="admin-delete-button" type="button" onClick={()=>void deletePaymentMethod(method.id)}>حذف</button>}</div></div>)}{paymentMethodMessage&&<p className="admin-form-message" role="status">{paymentMethodMessage}</p>}</section>}{section==="events"&&showEventForm&&<form className="admin-event-form" onSubmit={createEvent}><h3>{editingEventId?"تعديل بيانات الفعالية":"بيانات الفعالية"}</h3><div className="admin-form-grid"><label>اسم الفعالية *<input required value={eventForm.title} onChange={e=>setEventForm({...eventForm,title:e.target.value})}/></label><label>المدينة *<input required value={eventForm.city} onChange={e=>setEventForm({...eventForm,city:e.target.value})}/></label><label>المكان *<input required value={eventForm.venue} onChange={e=>setEventForm({...eventForm,venue:e.target.value})}/></label><label>العنوان التفصيلي<input value={eventForm.address} onChange={e=>setEventForm({...eventForm,address:e.target.value})}/></label><label>رابط الموقع / Google Maps<input type="url" placeholder="https://maps.google.com/..." value={eventForm.location_url} onChange={e=>setEventForm({...eventForm,location_url:e.target.value})}/></label><label className="admin-form-wide">صورة الغلاف (من جهازك)<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0]||null;setCoverFile(file);if(file){const url=URL.createObjectURL(file);setCoverPreview(url);}else{setCoverPreview(eventForm.cover_image_url);}}}/><small className="admin-form-hint">الصيغ المدعومة حسب المتصفح · الحد الأقصى 10 MB · تُرفع الصورة الأصلية دون ضغط.</small></label>{coverPreview&&<div className="admin-cover-preview"><img src={coverPreview} alt="معاينة صورة الغلاف"/><button type="button" onClick={()=>{setCoverFile(null);setCoverPreview("");setEventForm({...eventForm,cover_image_url:""});}}>إزالة الصورة</button></div>}<label>الزمان / تاريخ ووقت البداية *<input type="datetime-local" required value={eventForm.starts_at} onChange={e=>setEventForm({...eventForm,starts_at:e.target.value})}/></label><label>تاريخ ووقت النهاية<input type="datetime-local" value={eventForm.ends_at} onChange={e=>setEventForm({...eventForm,ends_at:e.target.value})}/></label></div><label className="admin-form-wide">عن الفعالية<textarea rows={3} value={eventForm.description} onChange={e=>setEventForm({...eventForm,description:e.target.value})}/></label><label className="admin-trending-check"><input type="checkbox" checked={eventForm.is_trending} onChange={e=>setEventForm({...eventForm,is_trending:e.target.checked})}/> إظهار الفعالية في «رائج الآن»</label><section className="admin-ticket-editor"><div className="admin-ticket-heading"><h3>حسابات التحويل الخاصة بالفعالية</h3><button type="button" className="admin-create-button" onClick={()=>setEventAccountForms(v=>[...v,{account_name:"",account_number:"",beneficiary:"",is_active:true,sort_order:(v.length+1)*10}])}>＋ إضافة حساب</button></div>{eventAccountForms.map((a,i)=><div className="admin-ticket-row" key={a.id||"event-account-"+i}><div className="admin-form-grid"><label>اسم البنك أو طريقة الدفع *<input value={a.account_name} onChange={e=>setEventAccountForms(v=>v.map((x,j)=>j===i?{...x,account_name:e.target.value}:x))}/></label><label>رقم الحساب *<input dir="ltr" value={a.account_number} onChange={e=>setEventAccountForms(v=>v.map((x,j)=>j===i?{...x,account_number:e.target.value}:x))}/></label><label>اسم المستفيد *<input value={a.beneficiary} onChange={e=>setEventAccountForms(v=>v.map((x,j)=>j===i?{...x,beneficiary:e.target.value}:x))}/></label><label className="admin-trending-check"><input type="checkbox" checked={a.is_active} onChange={e=>setEventAccountForms(v=>v.map((x,j)=>j===i?{...x,is_active:e.target.checked}:x))}/> متاح للحجز</label><button type="button" className="admin-delete-button" onClick={()=>setEventAccountForms(v=>v.filter((_,j)=>j!==i))}>إزالة الحساب</button></div></div>)}</section><div className="admin-ticket-editor"><div className="admin-ticket-heading"><h3>أنواع التذاكر</h3><button type="button" className="admin-create-button" onClick={()=>setTicketForms(v=>[...v,emptyTicket()])}>＋ إضافة فئة تذكرة</button></div>{ticketForms.map((t,i)=><div className="admin-ticket-row" key={t.id||"new-"+i}><div className="admin-ticket-row-head"><b>الفئة {i+1}</b>{ticketForms.length>1&&<button type="button" className="admin-delete-button" onClick={()=>setTicketForms(v=>v.filter((_,j)=>j!==i))}>إزالة</button>}</div><div className="admin-form-grid"><label>اسم التذكرة *<input required value={t.name} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,name:e.target.value}:x))}/></label><label>الوصف (اختياري)<input value={t.description} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,description:e.target.value}:x))}/></label><label>السعر *<input type="number" min="0" step="0.01" required value={t.price} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,price:e.target.value}:x))}/></label><label>العملة<select value={t.currency} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,currency:e.target.value}:x))}><option value="SDG">جنيه سوداني (SDG)</option><option value="SAR">ريال سعودي (SAR)</option><option value="AED">درهم إماراتي (AED)</option><option value="USD">دولار أمريكي (USD)</option><option value="EGP">جنيه مصري (EGP)</option></select></label><label>الكمية المتاحة *<input type="number" min={t.quantity_sold||1} step="1" required value={t.quantity_total} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,quantity_total:e.target.value}:x))}/></label><label>بداية البيع<input type="datetime-local" value={t.sales_start_at} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,sales_start_at:e.target.value}:x))}/></label><label>نهاية البيع<input type="datetime-local" value={t.sales_end_at} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,sales_end_at:e.target.value}:x))}/></label><label className="admin-trending-check"><input type="checkbox" checked={t.is_active} onChange={e=>setTicketForms(v=>v.map((x,j)=>j===i?{...x,is_active:e.target.checked}:x))}/> الفئة مفعّلة للحجز</label>{t.quantity_sold>0&&<small className="admin-form-hint">تم بيع {t.quantity_sold} — لا يمكن تقليل الكمية عنها.</small>}</div></div>)}</div><p className="admin-form-hint">سيتم حفظ الفعالية كمسودة، ولن تظهر للجمهور إلا بعد نشرها.</p>{eventMessage&&<p className="admin-form-message" role="status">{eventMessage}</p>}<button className="admin-create-button" type="submit" disabled={savingEvent}>{savingEvent?"جاري الحفظ...":editingEventId?"حفظ التعديلات":"حفظ الفعالية"}</button></form>}{sectionLoading?<p className="admin-no-data">جاري تحميل البيانات...</p>:renderRows()}</div>}
        <footer className="admin-footer">حاضر · نظام إدارة الفعاليات والتذاكر <span>{roleLabel}</span></footer>
      </div>
    </section>
  </main>;
}
