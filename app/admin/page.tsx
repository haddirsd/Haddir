"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import AdminEventsWorkspace from "../../features/events/admin/AdminEventsWorkspace";
import AdminBookingsWorkspace from "../../features/booking/admin/AdminBookingsWorkspace";
import { Activity, ArrowRight, BadgeCheck, Banknote, CalendarDays, ClipboardCheck, LayoutDashboard, LogOut, Shield, Ticket, Users, Wallet, RefreshCw } from "lucide-react";

type AdminRole = "owner" | "admin" | "supervisor";
type Section = "overview" | "events" | "bookings" | "payments" | "users" | "reports" | "activity";
type Row = Record<string, any>;
const labels: Record<Section, string> = { overview: "نظرة عامة", events: "الفعاليات", bookings: "الحجوزات", payments: "مراجعة المدفوعات", users: "المستخدمون", reports: "الإحصائيات", activity: "سجل الإجراءات" };
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
  const [rejectionReasons,setRejectionReasons]=useState<Record<string,string>>({});
  const [paymentActionMessage,setPaymentActionMessage]=useState("");
  const [updatingUserId,setUpdatingUserId]=useState<string|null>(null);
  const [userMessage,setUserMessage]=useState("");
  const [eventOptions,setEventOptions]=useState<Row[]>([]);
  const [roleDrafts,setRoleDrafts]=useState<Record<string,string>>({});
  const [assignmentEventIds,setAssignmentEventIds]=useState<Record<string,string>>({});
  const [statistics,setStatistics]=useState<{events:Row[];profiles:Row[];bookings:Row[];tickets:Row[]}|null>(null);
  const [statsView,setStatsView]=useState<"general"|"event">("general");
  const [statsEventId,setStatsEventId]=useState("");
  const [searchTerm,setSearchTerm]=useState("");
  const [userTotal,setUserTotal]=useState(0);
  const [darkMode,setDarkMode]=useState(false);

  useEffect(() => {
    const syncTheme = () => {
      const saved = window.localStorage.getItem("haddir-theme");
      const dark = saved ? saved === "dark" : !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      setDarkMode(dark);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    syncTheme();
    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, []);

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

  const nav = useMemo(() => role === "supervisor" ? (["overview","bookings","payments","activity"] as Section[]) : (["overview","events","bookings","payments","users","reports","activity"] as Section[]), [role]);

  const loadSection = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !role || section === "overview" || section === "events" || section === "bookings") return;
    setSectionLoading(true); setError(""); setRows([]);
    let result: {data:any[]|null,error:any} = {data:[],error:null};
    if (section === "activity") result = await supabase.from("admin_activity_log").select("id,actor_name,actor_role,action,entity_type,entity_label,event_id,booking_id,details,created_at,events(title)").order("created_at",{ascending:false}).limit(500);
    if (section === "payments") result = await supabase.from("payment_submissions").select("id,booking_id,transfer_reference,receipt_path,amount,currency,status,review_note,created_at,payment_account_id,payment_account_name,payment_account_number,payment_account_beneficiary,bookings(booking_number,customer_name,customer_email,customer_phone,subtotal,currency,events(title,city,venue,starts_at),booking_items(quantity,ticket_types(name)))").eq("status","submitted").order("created_at",{ascending:false}).limit(100);
    if (section === "users" && role !== "supervisor") {
      const term=searchTerm.trim().replace(/[(),]/g," ").replace(/[%_]/g,"");
      const [{data:userRows,error:userError},{count:totalCount,error:countError}]=await Promise.all([
        supabase.rpc("admin_search_profiles",{p_query:term||null,p_limit:100,p_offset:0}),
        supabase.from("profiles").select("id",{count:"exact",head:true})
      ]);
      result={data:userRows||null,error:userError||countError};
      setUserTotal(totalCount||0);
      if (!result.error) {
        const [{data:assignments,error:assignmentError},{data:events,error:eventError}] = await Promise.all([
          supabase.from("event_role_assignments").select("user_id,event_id,assignment_role"),
          supabase.from("events").select("id,title,status").in("status",["draft","published"]).order("created_at",{ascending:false}).limit(200)
        ]);
        if (assignmentError || eventError) { result = {data:null,error:assignmentError||eventError}; }
        else {
          setEventOptions(events||[]);
          const byUser = new Map((assignments||[]).map((a:any)=>[a.user_id,a.event_id]));
          result = {data:(result.data||[]).map((u:any)=>({...u,assignment_event_id:byUser.get(u.id)||""})),error:null};
        }
      }
    }
    if (section === "reports" && role !== "supervisor") {
      const fetchAll = async (table:string, columns:string, sort:string) => {
        const all:Row[]=[]; let offset=0;
        while(true){
          const {data,error}=await supabase.from(table).select(columns).order(sort,{ascending:false}).range(offset,offset+999);
          if(error)return {data:null,error};
          all.push(...(data||[]));
          if((data||[]).length<1000)break;
          offset+=1000;
        }
        return {data:all,error:null};
      };
      const [events,profiles,bookings,tickets]=await Promise.all([
        fetchAll("events","id,title,status,starts_at,ends_at,platform_fee_percent,ticket_types(id,name,price,currency,quantity_total,quantity_sold)","created_at"),
        fetchAll("profiles","id,role","created_at"),
        fetchAll("bookings","id,event_id,user_id,customer_email,customer_phone,subtotal,currency,status,created_at,booking_items(id,ticket_type_id,quantity,unit_price,line_total,ticket_types(name,currency))","created_at"),
        fetchAll("tickets","id,event_id,ticket_type_id,status","issued_at")
      ]);
      const failure=events.error||profiles.error||bookings.error||tickets.error;
      if(failure){setSectionLoading(false);setError("تعذر تحميل الإحصائيات: "+failure.message);return;}
      setStatistics({events:events.data||[],profiles:profiles.data||[],bookings:bookings.data||[],tickets:tickets.data||[]});
      setSectionLoading(false);
      return;
    }
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

  useEffect(() => { void loadSection(); }, [section, role, searchTerm]);

   useEffect(() => {
     const supabase=getSupabaseBrowserClient();
     if(!supabase||!role)return;
     const refreshOverview=async()=>{
       const [events,bookings,pending,users,confirmed]=await Promise.all([
         role==="supervisor"?Promise.resolve({count:null,error:null}):supabase.from("events").select("id",{count:"exact",head:true}),
         supabase.from("bookings").select("id",{count:"exact",head:true}),
         supabase.from("payment_submissions").select("id",{count:"exact",head:true}).eq("status","submitted"),
         role==="owner"||role==="admin"?supabase.from("profiles").select("id",{count:"exact",head:true}):Promise.resolve({count:null,error:null}),
         supabase.from("bookings").select("subtotal").eq("status","confirmed")
       ]);
       setCounts({events:events.count||0,bookings:bookings.count||0,pending:pending.count||0,users:users.count||0,confirmed:confirmed.data?.length||0,revenue:(confirmed.data||[]).reduce((sum:any,row:any)=>sum+Number(row.subtotal||0),0)});
     };
     const tables=section==="overview"?["events","bookings","payment_submissions"]:section==="payments"?["payment_submissions","bookings","booking_items"]:section==="activity"?["admin_activity_log"]:[];
     if(!tables.length)return;
     let channel=supabase.channel("admin-live-"+section);
     for(const table of tables){
       channel=channel.on("postgres_changes",{event:"*",schema:"public",table},()=>{
         if(section==="overview")void refreshOverview();
         else void loadSection();
       });
     }
     channel.subscribe();
     return()=>{void supabase.removeChannel(channel);};
   },[section,role,searchTerm]);

  const reviewPayment=async(row:Row,decision:"approve"|"reject")=>{
    const supabase=getSupabaseBrowserClient();if(!supabase||!role)return;
    const reason=decision==="reject"?(rejectionReasons[row.id]||"").trim():null;
    if(decision==="reject"&&!reason){setError("اكتب سبب الرفض أولاً حتى نرسله للعميل.");return;}
    if(decision==="approve"&&!window.confirm("تأكيد قبول الدفع وإصدار تذاكر برموز دخول من 10 أرقام؟"))return;
    setSectionLoading(true);setError("");
    const {data,error}=await supabase.rpc("review_payment_submission",{p_submission_id:row.id,p_decision:decision,p_rejection_reason:reason||null});
    setSectionLoading(false);
    if(error){setError("تعذرت مراجعة إثبات الدفع: "+error.message);return;}
    setRejectionReasons(v=>{const next={...v};delete next[row.id];return next;});
    setPaymentActionMessage(decision==="approve"?("تم اعتماد الدفع وإصدار "+Number(data?.tickets_created||0)+" تذكرة. حُفظ إشعار البريد في قائمة الانتظار، وسيُرسل بعد تفعيل إعدادات Resend."):"تم رفض إثبات الدفع وإرسال السبب للعميل. حُفظ إشعار البريد في قائمة الانتظار، وسيُرسل بعد تفعيل إعدادات Resend.");
    if(data?.booking_id){void supabase.functions.invoke("send-booking-email",{body:{booking_id:data.booking_id,decision}}).then(({error}:any)=>{if(error)console.info("Booking email remains queued until Resend is configured.");});}
    await loadSection();
  };

  const updateUserRole = async (userRow:Row, nextRole:string, eventId:string|null) => {
    const supabase=getSupabaseBrowserClient();
    if(!supabase||!role||!["owner","admin"].includes(role)||updatingUserId)return;
    if(userRow.role==="owner"){setError("لا يمكن تغيير صلاحية مالك المنصة.");return;}
    if(!["admin","supervisor","gatekeeper","advertiser","customer"].includes(nextRole))return;
    if((nextRole==="gatekeeper"||nextRole==="advertiser")&&!eventId){setError("اختار الفعالية أولاً لهذا المستخدم.");return;}
    const {data:{user}}=await supabase.auth.getUser();
    if(user?.id===userRow.id){setError("لا يمكنك تغيير دور حسابك الحالي من هنا.");return;}
    if(!window.confirm("تأكيد تغيير دور "+(userRow.full_name||"هذا المستخدم")+"؟"))return;
    setUpdatingUserId(userRow.id);setError("");setUserMessage("");
    const {error:updateError}=await supabase.rpc("admin_update_profile_role",{p_user_id:userRow.id,p_role:nextRole,p_event_id:eventId});
    setUpdatingUserId(null);
    if(updateError){setError("تعذر تعديل دور المستخدم: "+updateError.message);return;}
    setRows(current=>current.map(item=>item.id===userRow.id?{...item,role:nextRole,assignment_event_id:eventId||""}:item));
    setRoleDrafts(v=>({...v,[userRow.id]:nextRole}));
    setAssignmentEventIds(v=>({...v,[userRow.id]:eventId||""}));
    setUserMessage("تم تحديث دور المستخدم بنجاح.");
  };

  const signOut = async () => { const supabase = getSupabaseBrowserClient(); if (supabase) await supabase.auth.signOut(); router.replace("/"); };

  if (loading) return <main className={"admin-loading"+(darkMode?" theme-dark":"")} dir="rtl"><div className="admin-spinner"/><p>جاري التحقق من صلاحياتك...</p></main>;
  if (!role) return <main className={"admin-denied"+(darkMode?" theme-dark":"")} dir="rtl"><Shield size={34}/><h1>الوصول غير متاح</h1><p>{error || "هذه الصفحة مخصصة لفريق إدارة حاضر."}</p><button onClick={() => router.replace("/")}>العودة للرئيسية</button></main>;

  const supervisor = role === "supervisor";
  const roleLabel = role === "owner" ? "مالك المنصة" : role === "admin" ? "المشرف الإداري" : "موظف حاضر";
  const metrics = supervisor
    ? [{title:"إثباتات بانتظار المراجعة",value:counts.pending,icon:ClipboardCheck},{title:"الحجوزات",value:counts.bookings,icon:Ticket}]
    : [{title:"الفعاليات",value:counts.events,icon:CalendarDays},{title:"الحجوزات",value:counts.bookings,icon:Ticket},{title:"إثباتات بانتظار المراجعة",value:counts.pending,icon:ClipboardCheck},{title:"حسابات المستخدمين",value:counts.users,icon:Users}];

  const renderRows = () => {
    if (section === "activity") {
      const actionNames:Record<string,string>={"events.created":"أضاف فعالية","events.updated":"عدّل بيانات فعالية","events.deleted":"حذف فعالية","event.cancelled":"ألغى فعالية / أخفاها","event.published":"نشر فعالية","profiles.created":"أضاف عميلاً / مستخدماً","user.role_changed":"غيّر دور مستخدم","bookings.created":"أنشأ حجزاً","booking.confirmed":"وافق على الحجز","booking.rejected":"رفض الحجز","payment.approved":"اعتمد إثبات الدفع","payment.rejected":"رفض إثبات الدفع","ticket.checked_in":"أكد دخول التذكرة","tickets.deleted":"حذف تذكرة","ticket.checkin_reversed":"ألغى تأكيد دخول التذكرة","ticket.status_changed":"عدّل حالة التذكرة","ticket_types.created":"أضاف فئة تذاكر","ticket_types.updated":"عدّل فئة تذاكر","ticket_types.deleted":"حذف فئة تذاكر","event_payment_accounts.created":"أضاف حساب دفع","event_payment_accounts.updated":"عدّل حساب دفع","event_payment_accounts.deleted":"حذف حساب دفع"};
      const roleNames:Record<string,string>={owner:"مالك المنصة",admin:"مشرف",supervisor:"موظف حاضر",gatekeeper:"بواب",organizer:"بواب",advertiser:"معلن",customer:"عميل",unknown:"غير معروف"};
      const fieldNames:Record<string,string>={title:"اسم الفعالية",status:"الحالة",description:"الوصف",venue:"المكان",city:"المدينة",starts_at:"موعد البداية",ends_at:"موعد النهاية",platform_fee_percent:"نسبة العمولة",role:"الدور",full_name:"الاسم",is_trending:"رائج الآن",price:"السعر",quantity_total:"الكمية",name:"الاسم",is_active:"التفعيل"};
      const detailText=(details:Row)=>Object.entries(details||{}).map(([key,value]:[string,any])=>{const v=value&&typeof value==="object"&&("before" in value||"after" in value)?`من ${JSON.stringify(value.before)} إلى ${JSON.stringify(value.after)}`:JSON.stringify(value);return `${fieldNames[key]||key}: ${v}`;}).join(" · ");
      return <div className="admin-table-wrap"><table className="admin-data-table"><thead><tr><th>المنفّذ</th><th>دوره</th><th>الإجراء</th><th>العنصر</th><th>التفاصيل</th><th>التاريخ والوقت</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}><td><strong>{r.actor_name||"مستخدم غير معروف"}</strong></td><td>{roleNames[r.actor_role]||r.actor_role}</td><td>{actionNames[r.action]||r.action}</td><td>{r.entity_label||r.entity_type||"—"}{r.events?.title&&<small className="admin-stat-hint"> · {r.events.title}</small>}</td><td>{detailText(r.details)||"—"}</td><td>{r.created_at?new Date(r.created_at).toLocaleString("ar-SD"):"—"}</td></tr>)}</tbody></table>{rows.length===0&&<p className="admin-no-data">لا توجد إجراءات مسجلة حتى الآن. ستظهر الإجراءات الجديدة هنا تلقائياً.</p>}<p className="admin-stats-note">يعرض السجل آخر 500 إجراء. اسم المنفّذ ودوره محفوظان وقت تنفيذ الإجراء ولا يتغيران بتغيير بيانات الحساب لاحقاً.</p></div>;
    }
    if (section === "reports") {
      const data=statistics;
      if(!data)return <p className="admin-no-data">جاري تجهيز الإحصائيات...</p>;
      const fmtCount=(v:number)=>v.toLocaleString("ar-SD");
      const sum=(items:Row[],field:string)=>items.reduce((n,x)=>n+Number(x[field]||0),0);
      const moneyLines=(items:Row[],field:string)=>{const grouped=new Map<string,number>();items.forEach(x=>{const c=String(x.currency||"SDG").trim();grouped.set(c,(grouped.get(c)||0)+Number(x[field]||0));});return grouped.size?Array.from(grouped.entries()).map(([c,v])=>money(v,c)).join(" · "):money(0,"SDG");};
      const confirmed=data.bookings.filter(x=>x.status==="confirmed");
      const rejected=data.bookings.filter(x=>x.status==="rejected");
      const pending=data.bookings.filter(x=>["pending_payment","under_review"].includes(x.status));
      const totalCapacity=sum(data.events.flatMap(e=>e.ticket_types||[]),"quantity_total");
      const soldTickets=data.tickets.filter(t=>["valid","used"].includes(t.status));
      const rejectedQty=sum(rejected.flatMap(b=>b.booking_items||[]),"quantity");
      const currentEvents=data.events.filter(e=>e.status==="published"&&(!e.ends_at||new Date(e.ends_at).getTime()>=Date.now()));
      const pastEvents=data.events.filter(e=>e.status==="completed"||(!!e.ends_at&&new Date(e.ends_at).getTime()<Date.now()));
      const roleCounts=(r:string)=>data.profiles.filter(p=>p.role===r||(r==="gatekeeper"&&p.role==="organizer")).length;
      const revenueRows=confirmed.map(b=>({currency:b.currency,value:Number(b.subtotal||0)}));
      const commissionRows=confirmed.map(b=>({currency:b.currency,value:Number(b.subtotal||0)*Number(data.events.find(e=>e.id===b.event_id)?.platform_fee_percent||0)/100}));
      const event=data.events.find(e=>e.id===statsEventId);
      const eventBookings=event?data.bookings.filter(b=>b.event_id===event.id):[];
      const eventConfirmed=eventBookings.filter(b=>b.status==="confirmed");
      const eventRejected=eventBookings.filter(b=>b.status==="rejected");
      const eventPeople=new Set(eventBookings.filter(b=>!["rejected","cancelled","expired"].includes(b.status)).map(b=>b.user_id||b.customer_email||b.customer_phone||b.id)).size;
      const eventTicketRows=(event?.ticket_types||[]).map((type:Row)=>{
        const items=eventConfirmed.flatMap(b=>b.booking_items||[]).filter((i:any)=>i.ticket_type_id===type.id);
        const rejectedItems=eventRejected.flatMap(b=>b.booking_items||[]).filter((i:any)=>i.ticket_type_id===type.id);
        const sold=sum(items,"quantity");
        const revenue=items.reduce((n,i:any)=>n+Number(i.line_total||Number(i.unit_price||0)*Number(i.quantity||0)),0);
        return {...type,sold,rejectedCount:sum(rejectedItems,"quantity"),revenue,remaining:Math.max(0,Number(type.quantity_total||0)-sold)};
      });
      const eventRevenueRows=eventConfirmed.flatMap(b=>(b.booking_items||[]).map((i:any)=>({currency:i.ticket_types?.currency||b.currency,value:Number(i.line_total||Number(i.unit_price||0)*Number(i.quantity||0))})));
      const eventCommissionRows=eventRevenueRows.map(x=>({currency:x.currency,value:x.value*Number(event?.platform_fee_percent||0)/100}));
      const metricCards=(items:{title:string;value:string|number;hint?:string}[]) => <div className="admin-metric-grid">{items.map(x=><article className="admin-metric" key={x.title}><small>{x.title}</small><strong>{typeof x.value==="number"?fmtCount(x.value):x.value}</strong>{x.hint&&<span className="admin-stat-hint">{x.hint}</span>}</article>)}</div>;
      return <div className="admin-statistics">
        <div className="admin-stat-tabs">
          <button className={statsView==="general"?"active":""} onClick={()=>setStatsView("general")}>الإحصائيات العامة</button>
          <button className={statsView==="event"?"active":""} onClick={()=>setStatsView("event")}>إحصائيات الفعالية</button>
        </div>
        {statsView==="general"?<>
          <h3 className="admin-stats-heading">ملخص الفعاليات</h3>
          {metricCards([{title:"كل الفعاليات",value:data.events.length},{title:"الفعاليات الحالية",value:currentEvents.length},{title:"الفعاليات السابقة",value:pastEvents.length},{title:"المسودات",value:data.events.filter(e=>e.status==="draft").length},{title:"الفعاليات الملغاة",value:data.events.filter(e=>e.status==="cancelled").length}])}
          <h3 className="admin-stats-heading">المستخدمون والأدوار</h3>
          {metricCards([{title:"إجمالي المستخدمين",value:data.profiles.length},{title:"العملاء",value:roleCounts("customer")},{title:"البوابون",value:roleCounts("gatekeeper")},{title:"الموظفون",value:roleCounts("supervisor")},{title:"المشرفون",value:roleCounts("admin")},{title:"المعلنون",value:roleCounts("advertiser")}])}
          <h3 className="admin-stats-heading">التذاكر والحجوزات</h3>
          {metricCards([{title:"إجمالي سعة التذاكر",value:totalCapacity},{title:"التذاكر المحجوزة/الصادرة",value:soldTickets.length},{title:"التذاكر المستخدمة",value:data.tickets.filter(t=>t.status==="used").length},{title:"التذاكر المتبقية",value:Math.max(0,totalCapacity-soldTickets.length)},{title:"ضمن حجوزات مرفوضة",value:rejectedQty},{title:"إجمالي الحجوزات",value:data.bookings.length},{title:"الحجوزات المؤكدة",value:confirmed.length},{title:"الحجوزات المرفوضة",value:rejected.length},{title:"بانتظار الدفع/المراجعة",value:pending.length}])}
          <h3 className="admin-stats-heading">المبيعات وأرباح المنصة</h3>
          {metricCards([{title:"إجمالي المبيعات المعتمدة",value:moneyLines(revenueRows,"value")},{title:"صافي دخل المنصة (العمولة)",value:moneyLines(commissionRows,"value"),hint:"حسب نسبة العمولة لكل فعالية، قبل المصروفات التشغيلية"}])}
          <h3 className="admin-stats-heading">ملخص كل فعالية</h3>
          <div className="admin-table-wrap"><table className="admin-data-table"><thead><tr><th>الفعالية</th><th>الحالة</th><th>الحجوزات</th><th>التذاكر المحجوزة</th><th>السعة</th><th>المبيعات المعتمدة</th><th>دخل المنصة</th></tr></thead><tbody>{data.events.map(e=>{const eb=data.bookings.filter(b=>b.event_id===e.id);const ec=eb.filter(b=>b.status==="confirmed");const issued=data.tickets.filter(t=>t.event_id===e.id&&["valid","used"].includes(t.status)).length;const sales=ec.map(b=>({currency:b.currency,value:Number(b.subtotal||0)}));const fees=ec.map(b=>({currency:b.currency,value:Number(b.subtotal||0)*Number(e.platform_fee_percent||0)/100}));const caps=e.ticket_types||[];return <tr key={e.id}><td>{e.title}</td><td>{statusLabels[e.status]||e.status}</td><td>{fmtCount(eb.length)}</td><td>{fmtCount(issued)}</td><td>{fmtCount(sum(caps,"quantity_total"))}</td><td>{moneyLines(sales,"value")}</td><td>{moneyLines(fees,"value")}</td></tr>;})}</tbody></table></div>
          <p className="admin-stats-note">المبيعات تشمل الحجوزات المؤكدة فقط. دخل المنصة هو قيمة العمولة المحسوبة من نسبة كل فعالية، قبل المصروفات التشغيلية. الطلبات المرفوضة والمعلقة لا تدخل في الإيرادات.</p>
        </>:<>
          <div className="admin-event-stat-select"><label htmlFor="stats-event-select">اختار الفعالية</label><select id="stats-event-select" value={statsEventId} onChange={e=>setStatsEventId(e.target.value)}><option value="">اختر فعالية...</option>{data.events.map(e=><option key={e.id} value={e.id}>{e.title} — {statusLabels[e.status]||e.status}</option>)}</select></div>
          {!event?<p className="admin-no-data">اختار فعالية عشان تظهر إحصائياتها.</p>:<>
            <div className="admin-selected-event"><div><small>الفعالية المحددة</small><h3>{event.title}</h3><span>{statusLabels[event.status]||event.status} · عمولة المنصة {Number(event.platform_fee_percent||0)}%</span></div><button className="admin-print-button" type="button" onClick={()=>window.print()}>طباعة الإحصائيات PDF</button></div>
            <div className="admin-print-report-head"><b>حاضِر · تقرير إحصائيات فعالية</b><h2>{event.title}</h2><p>الحالة: {statusLabels[event.status]||event.status} · عمولة المنصة: {Number(event.platform_fee_percent||0)}% · تاريخ التقرير: {new Date().toLocaleString("ar-SD")}</p></div>
            {metricCards([{title:"عدد الحاجزين",value:eventPeople},{title:"الحجوزات المؤكدة",value:eventConfirmed.length},{title:"الحجوزات المرفوضة",value:eventRejected.length},{title:"التذاكر المتاحة",value:sum(eventTicketRows,"quantity_total")},{title:"التذاكر المباعة",value:sum(eventTicketRows,"sold")},{title:"التذاكر المرفوضة",value:sum(eventTicketRows,"rejectedCount")},{title:"التذاكر المتبقية",value:sum(eventTicketRows,"remaining")},{title:"إجمالي المبيعات",value:moneyLines(eventRevenueRows,"value")},{title:"صافي دخل المنصة (العمولة)",value:moneyLines(eventCommissionRows,"value"),hint:Number(event.platform_fee_percent||0)===0?"لا توجد عمولة مستحقة على هذه الفعالية":"محسوبة من المبيعات المعتمدة فقط"}])}
            <h3 className="admin-stats-heading">تفاصيل فئات التذاكر</h3>
            <div className="admin-table-wrap"><table className="admin-data-table"><thead><tr><th>الفئة</th><th>السعر</th><th>الإجمالي</th><th>المباع</th><th>المرفوض</th><th>المتبقي</th><th>قيمة المبيعات</th></tr></thead><tbody>{eventTicketRows.map((t:Row)=><tr key={t.id}><td>{t.name}</td><td>{money(t.price,t.currency)}</td><td>{fmtCount(Number(t.quantity_total||0))}</td><td>{fmtCount(t.sold)}</td><td>{fmtCount(t.rejectedCount)}</td><td>{fmtCount(t.remaining)}</td><td>{money(t.revenue,t.currency)}</td></tr>)}</tbody></table></div>
          </>}
        </>}
      </div>;
    }
    const columns: Record<string,{key:string,label:string,format?:(r:Row)=>string}[]> = {
      events:[{key:"title",label:"الفعالية"},{key:"category",label:"التصنيف"},{key:"city",label:"المدينة"},{key:"venue",label:"الموقع"},{key:"starts_at",label:"الموعد",format:r=>r.starts_at?new Date(r.starts_at).toLocaleString("ar-SD"):"—"},{key:"status",label:"الحالة",format:r=>statusLabels[r.status]||fmt(r.status)}],
      payments:[{key:"booking",label:"الحجز",format:r=>r.bookings?.booking_number||r.booking_id},{key:"customer",label:"الزبون",format:r=>r.bookings?.customer_name||"—"},{key:"transfer_reference",label:"مرجع التحويل"},{key:"receipt_url",label:"الإيصال",format:r=>r.receipt_url?"متاح":"—"},{key:"amount",label:"المبلغ",format:r=>money(r.amount,r.currency)},{key:"status",label:"الحالة",format:r=>statusLabels[r.status]||fmt(r.status)},{key:"review_note",label:"ملاحظة المراجعة"},{key:"created_at",label:"التاريخ",format:r=>new Date(r.created_at).toLocaleDateString("ar-SD")}],
      users:[{key:"full_name",label:"الاسم"},{key:"phone",label:"الهاتف"},{key:"role",label:"الدور"},{key:"created_at",label:"تاريخ التسجيل",format:r=>new Date(r.created_at).toLocaleDateString("ar-SD")}]
    };
    const cols=columns[section]||[];
    if(section==="users"){
      const roleNames:Record<string,string>={owner:"مالك المنصة",admin:"مشرف",supervisor:"موظف حاضر",organizer:"منظم حاضر",gatekeeper:"منظم حاضر",advertiser:"مُعلن",customer:"عميل"};
      return <div className="admin-users-table-wrap">
        <table className="admin-users-table">
          <thead><tr><th>الإسم</th><th>رقم الهاتف</th><th>الدور</th><th>تاريخ التسجيل</th><th>تعديل الدور / الفعالية</th></tr></thead>
          <tbody>{rows.map((r,i)=>{
            const draftRole=roleDrafts[r.id]||r.role||"customer";
            const selectedEvent=assignmentEventIds[r.id]??r.assignment_event_id??"";
            const protectedUser=r.role==="owner";
            return <tr key={r.id||i}>
              <td data-label="الإسم"><strong>{fmt(r.full_name)}</strong></td>
              <td data-label="رقم الهاتف"><span dir="ltr">{fmt(r.phone)}</span><small className="admin-user-email" dir="ltr">{fmt(r.email)}</small></td>
              <td data-label="الدور"><span className="admin-user-role">{roleNames[r.role]||fmt(r.role)}</span></td>
              <td data-label="تاريخ التسجيل">{r.created_at?new Date(r.created_at).toLocaleDateString("ar-SD"):"—"}</td>
              <td data-label="تعديل الدور / الفعالية">
                <div className="admin-user-role-editor">
                  <select aria-label={"تعديل دور "+(r.full_name||"المستخدم")} value={draftRole} disabled={updatingUserId===r.id||protectedUser} onChange={e=>setRoleDrafts(v=>({...v,[r.id]:e.target.value}))}>
                    <option value="customer">عميل</option><option value="admin">مشرف إداري</option><option value="supervisor">موظف حاضر</option><option value="gatekeeper">منظم حاضر (بواب)</option><option value="advertiser">مُعلن</option>
                    {r.role==="organizer"&&<option value="organizer">منظم حاضر</option>}
                    {protectedUser&&<option value={r.role}>{roleNames[r.role]||r.role}</option>}
                  </select>
                  {(draftRole==="gatekeeper"||draftRole==="advertiser"||draftRole==="organizer")&&<select aria-label="اختيار الفعالية" value={selectedEvent} disabled={updatingUserId===r.id} onChange={e=>setAssignmentEventIds(v=>({...v,[r.id]:e.target.value}))}>
                    <option value="">اختر الفعالية (تشمل المسودات)</option>
                    {eventOptions.map((ev:any)=><option key={ev.id} value={ev.id}>{ev.title} · {ev.status==="draft"?"مسودة":ev.status==="published"?"منشورة":ev.status}</option>)}
                  </select>}
                  {!protectedUser&&<button type="button" className="admin-user-save-role" disabled={updatingUserId===r.id||draftRole==="organizer"||((draftRole==="gatekeeper"||draftRole==="advertiser")&&!selectedEvent)||draftRole===r.role&&((draftRole!=="gatekeeper"&&draftRole!=="advertiser")||selectedEvent===(r.assignment_event_id||""))} onClick={()=>void updateUserRole(r,draftRole,(draftRole==="gatekeeper"||draftRole==="advertiser")?selectedEvent:null)}>{updatingUserId===r.id?"جاري الحفظ…":"حفظ"}</button>}
                </div>
                {updatingUserId===r.id&&<small className="admin-user-saving">جاري الحفظ…</small>}
              </td>
            </tr>;
          })}</tbody>
        </table>
        {rows.length===0&&<p className="admin-no-data">لا يوجد مستخدمون مسجلون حتى الآن.</p>}
      </div>;
    }
    if(section==="payments"){
      return <div className="admin-payment-cards">
        {rows.length===0?<p className="admin-no-data">لا توجد إثباتات دفع حتى الآن.</p>:rows.map((r,i)=>{
          const pending=r.status==="submitted";
          return <article className="admin-payment-card" key={r.id||i}>
            <div className="admin-payment-card-head">
              <div><small>رقم الحجز</small><h4>{r.bookings?.booking_number||"—"}</h4></div>
              <span className={"admin-event-status status-"+(r.status||"submitted")}>{statusLabels[r.status]||fmt(r.status)}</span>
            </div>
            <div className="admin-payment-card-event"><Ticket size={17}/><strong>{r.bookings?.events?.title||"فعالية غير محددة"}</strong></div>
            <div className="admin-payment-card-grid">
              <div><small>المدينة والمكان</small><strong>{[r.bookings?.events?.city,r.bookings?.events?.venue].filter(Boolean).join(" · ")||"—"}</strong></div>
              <div><small>العميل</small><strong>{fmt(r.bookings?.customer_name)}</strong></div>
              <div><small>البريد الإلكتروني</small><strong>{fmt(r.bookings?.customer_email)}</strong></div>
              <div><small>رقم الهاتف</small><strong dir="ltr">{fmt(r.bookings?.customer_phone)}</strong></div>
              <div><small>المبلغ المحوّل</small><strong>{money(r.amount,r.currency)}</strong></div>
              <div><small>وسيلة الدفع</small><strong>{fmt(r.payment_account_name)}</strong></div>
              <div><small>رقم الحساب</small><strong dir="ltr">{fmt(r.payment_account_number)}</strong></div>
              <div><small>اسم المستفيد</small><strong>{fmt(r.payment_account_beneficiary)}</strong></div>
              <div><small>التذاكر</small><strong>{(r.bookings?.booking_items||[]).map((x:any)=>`${x.ticket_types?.name||"تذكرة"} × ${x.quantity}`).join("، ")||"—"}</strong></div>
              <div><small>مرجع التحويل</small><strong>{fmt(r.transfer_reference)}</strong></div>
              <div><small>تاريخ الإرسال</small><strong>{r.created_at?new Date(r.created_at).toLocaleString("ar-SD"):"—"}</strong></div>
              <div><small>الإيصال</small>{r.receipt_url?<a className="admin-payment-receipt" href={r.receipt_url} target="_blank" rel="noreferrer">عرض إيصال التحويل</a>:<strong>غير مرفق</strong>}</div>
              {r.review_note&&<div className="admin-payment-note"><small>ملاحظة المراجعة</small><strong>{r.review_note}</strong></div>}
            </div>
            {pending&&<div className="admin-payment-actions">
              <button className="admin-payment-approve" type="button" disabled={sectionLoading||!r.receipt_url} onClick={()=>void reviewPayment(r,"approve")}>قبول الدفع وإصدار التذاكر</button>
              <div className="admin-payment-reject-box">
                <label>سبب الرفض (سيصل للعميل)<textarea rows={2} value={rejectionReasons[r.id]||""} onChange={e=>setRejectionReasons(v=>({...v,[r.id]:e.target.value}))} placeholder="مثلاً: صورة الإيصال غير واضحة أو المبلغ غير مطابق..."/></label>
                <button className="admin-payment-reject" type="button" disabled={sectionLoading||!(rejectionReasons[r.id]||"").trim()} onClick={()=>void reviewPayment(r,"reject")}>رفض وإرسال السبب</button>
              </div>
            </div>}
          </article>;
        })}
      </div>;
    }
    return <div className="admin-table-wrap"><table className="admin-data-table"><thead><tr>{cols.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}>{cols.map(c=><td key={c.key}>{c.format?c.format(r):fmt(r[c.key])}</td>)}</tr>)}</tbody></table>{rows.length===0&&<p className="admin-no-data">لا توجد سجلات حتى الآن.</p>}</div>;
  };

  return <main className={"admin-shell"+(darkMode?" theme-dark":"")} dir="rtl">
    <aside className="admin-sidebar">
      <button className="admin-brand" onClick={() => router.push("/")}><span>ح</span><b>حاضر</b><small>الإدارة</small></button>
      <div className="admin-side-caption">مساحة العمل</div>
      <nav aria-label="تبويبات لوحة الإدارة">{nav.map(item=><button key={item} className={section===item?"active":""} onClick={()=>setSection(item)}><span>{item==="overview"?<LayoutDashboard/>:item==="events"?<CalendarDays/>:item==="bookings"?<Ticket/>:item==="payments"?<Banknote/>:item==="users"?<Users/>:<Activity/>}</span>{labels[item]}</button>)}</nav>
      <div className="admin-side-bottom"><div className="admin-mini-profile"><span>{role==="owner"?<Shield/>:role==="admin"?<BadgeCheck/>:<ClipboardCheck/>}</span><div><b>{name}</b><small>{roleLabel}</small></div></div><button className="admin-logout" onClick={signOut}><LogOut size={17}/> تسجيل الخروج</button></div>
    </aside>
    <section className="admin-main">
      <header className="admin-topbar"><div><span>حاضر / لوحة الإدارة</span><h1>{labels[section]}</h1></div><div className="admin-top-user"><span>{roleLabel}</span><span className="admin-avatar">{name.slice(0,1)}</span></div></header>
      <div className="admin-content">
        <div className="admin-welcome"><div><span className="admin-eyebrow">لوحة التحكم</span><h2>مرحباً، {name}</h2><p>{supervisor?"راجع الحجوزات وإثباتات التحويل.":"تابع أداء منصة حاضر وأدر عملياتها من مكان واحد."}</p></div><div className="admin-welcome-mark"><LayoutDashboard size={30}/></div></div>
        {error&&<div className="admin-notice" role="status">{error}</div>}
        {paymentActionMessage&&<div className="admin-notice" role="status">{paymentActionMessage}</div>}
        {section==="overview"&&<><div className="admin-metric-grid">{metrics.map(m=><article className="admin-metric" key={m.title}><span><m.icon size={20}/></span><small>{m.title}</small><strong>{dataReady?m.value.toLocaleString("ar-SD"):"—"}</strong></article>)}</div><div className="admin-panel"><div className="admin-panel-head"><div><h3>{supervisor?"المهام اليومية":"نظرة سريعة"}</h3><p>بيانات مباشرة من قاعدة بيانات حاضر</p></div></div><div className="admin-shortcuts">{(supervisor?["bookings","payments"] as Section[]:["events","bookings","payments","users","reports"] as Section[]).map(item=><button key={item} onClick={()=>setSection(item)}><span>{item==="events"?<CalendarDays/>:item==="bookings"?<Ticket/>:item==="payments"?<Wallet/>:item==="users"?<Users/>:<Activity/>}</span><b>{labels[item]}</b><ArrowRight size={16}/></button>)}</div></div></>}
        {section==="events"?<AdminEventsWorkspace role={role}/>:section==="bookings"?<AdminBookingsWorkspace searchTerm={searchTerm} onSearchTermChange={setSearchTerm}/>:section!=="overview"&&<div className="admin-panel"><div className="admin-panel-head"><div><h3>{labels[section]}</h3><p>"السجلات الفعلية المحفوظة في قاعدة البيانات"</p></div><div className="admin-panel-actions">{section==="users"&&<label className="admin-search-box"><span>بحث بالرقم أو البريد أو الهاتف</span><input type="search" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="رقم الهاتف أو البريد الإلكتروني"/></label>}{section==="users"&&<span className="admin-user-total">عدد المستخدمين: {userTotal.toLocaleString("ar-SD")}</span>}<button className="admin-refresh" onClick={()=>void loadSection()} disabled={sectionLoading}><RefreshCw size={16}/> تحديث</button></div></div>{sectionLoading?<p className="admin-no-data">جاري تحميل البيانات...</p>:renderRows()}</div>}
        <footer className="admin-footer">حاضر · نظام إدارة الفعاليات والتذاكر <span>{roleLabel}</span></footer>
      </div>
    </section>
  </main>;
}
