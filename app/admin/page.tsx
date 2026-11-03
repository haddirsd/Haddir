"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import { Activity, ArrowRight, BadgeCheck, Banknote, CalendarDays, ClipboardCheck, LayoutDashboard, LogOut, Shield, Ticket, Users, Wallet, RefreshCw } from "lucide-react";

type AdminRole = "owner" | "admin" | "supervisor";
type Section = "overview" | "events" | "bookings" | "payments" | "users" | "reports";
type Row = Record<string, any>;
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

  const nav = useMemo(() => role === "supervisor" ? (["overview","bookings","payments"] as Section[]) : (["overview","events","bookings","payments","users","reports"] as Section[]), [role]);

  const loadSection = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !role || section === "overview") return;
    setSectionLoading(true); setError(""); setRows([]);
    let result: {data:any[]|null,error:any} = {data:[],error:null};
    if (section === "events") result = await supabase.from("events").select("id,title,category,city,venue,starts_at,status,created_at").order("created_at",{ascending:false}).limit(100);
    if (section === "bookings") result = await supabase.from("bookings").select("id,booking_number,customer_name,customer_phone,event_id,subtotal,currency,status,created_at").order("created_at",{ascending:false}).limit(100);
    if (section === "payments") result = await supabase.from("payment_submissions").select("id,booking_id,transfer_reference,receipt_path,amount,currency,status,review_note,created_at,bookings(booking_number,customer_name,customer_phone,subtotal)").order("created_at",{ascending:false}).limit(100);
    if (section === "users" && role !== "supervisor") result = await supabase.from("profiles").select("id,full_name,phone,role,created_at").order("created_at",{ascending:false}).limit(100);
    if (section === "reports" && role !== "supervisor") result = await supabase.from("bookings").select("subtotal,currency,status,created_at").order("created_at",{ascending:false}).limit(500);
    setSectionLoading(false);
    if (result.error) { setError("تعذر تحميل بيانات هذا القسم: " + result.error.message); return; }
    setRows(result.data || []);
  };

  useEffect(() => { void loadSection(); }, [section, role]);

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
      bookings:[{key:"booking_number",label:"رقم الحجز"},{key:"customer_name",label:"الزبون"},{key:"customer_phone",label:"الهاتف"},{key:"subtotal",label:"المبلغ",format:r=>money(r.subtotal,r.currency)},{key:"status",label:"الحالة",format:r=>statusLabels[r.status]||fmt(r.status)},{key:"created_at",label:"التاريخ",format:r=>new Date(r.created_at).toLocaleDateString("ar-SD")}],
      payments:[{key:"booking",label:"الحجز",format:r=>r.bookings?.booking_number||r.booking_id},{key:"customer",label:"الزبون",format:r=>r.bookings?.customer_name||"—"},{key:"transfer_reference",label:"مرجع التحويل"},{key:"amount",label:"المبلغ",format:r=>money(r.amount,r.currency)},{key:"status",label:"الحالة",format:r=>statusLabels[r.status]||fmt(r.status)},{key:"review_note",label:"ملاحظة المراجعة"},{key:"created_at",label:"التاريخ",format:r=>new Date(r.created_at).toLocaleDateString("ar-SD")}],
      users:[{key:"full_name",label:"الاسم"},{key:"phone",label:"الهاتف"},{key:"role",label:"الدور"},{key:"created_at",label:"تاريخ التسجيل",format:r=>new Date(r.created_at).toLocaleDateString("ar-SD")}]
    };
    const cols=columns[section]||[];
    return <div className="admin-table-wrap"><table className="admin-data-table"><thead><tr>{cols.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}>{cols.map(c=><td key={c.key}>{c.format?c.format(r):fmt(r[c.key])}{section==="payments"&&c.key==="transfer_reference"&&r.receipt_path?<small className="admin-table-sub"> · إيصال: {r.receipt_path}</small>:null}</td>)}</tr>)}</tbody></table>{rows.length===0&&<p className="admin-no-data">لا توجد سجلات حتى الآن.</p>}</div>;
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
        {section!=="overview"&&<div className="admin-panel"><div className="admin-panel-head"><div><h3>{labels[section]}</h3><p>السجلات الفعلية المحفوظة في قاعدة البيانات</p></div><button className="admin-refresh" onClick={()=>void loadSection()} disabled={sectionLoading}><RefreshCw size={16}/> تحديث</button></div>{sectionLoading?<p className="admin-no-data">جاري تحميل البيانات...</p>:renderRows()}</div>}
        <footer className="admin-footer">حاضر · نظام إدارة الفعاليات والتذاكر <span>{roleLabel}</span></footer>
      </div>
    </section>
  </main>;
}
