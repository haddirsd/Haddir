"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import { Activity, ArrowRight, BadgeCheck, Banknote, CalendarDays, ClipboardCheck, LayoutDashboard, LogOut, Shield, Ticket, Users, Wallet } from "lucide-react";

type AdminRole = "owner" | "admin" | "supervisor";
type Section = "overview" | "events" | "bookings" | "payments" | "users" | "reports";
const labels: Record<Section, string> = { overview: "نظرة عامة", events: "الفعاليات", bookings: "الحجوزات", payments: "مراجعة المدفوعات", users: "المستخدمون", reports: "التقارير" };

export default function AdminPage() {
  const router = useRouter();
  const [role, setRole] = useState<AdminRole | null>(null);
  const [name, setName] = useState("");
  const [section, setSection] = useState<Section>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState({ events: 0, bookings: 0, pending: 0, users: 0 });
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
        setError("ليس لديك صلاحية الوصول إلى لوحة الإدارة.");
        setLoading(false);
        return;
      }
      setRole(profile.role as AdminRole);
      setName(profile.full_name || user.email || "فريق حاضر");
      setLoading(false);
      const [events, bookings, pending, users] = await Promise.all([
        profile.role === "supervisor" ? Promise.resolve({ count: null, error: null }) : supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("bookings").select("id", { count: "exact", head: true }),
        supabase.from("payment_submissions").select("id", { count: "exact", head: true }).eq("status", "submitted"),
        profile.role === "owner" || profile.role === "admin" ? supabase.from("profiles").select("id", { count: "exact", head: true }) : Promise.resolve({ count: null, error: null })
      ]);
      if (!alive) return;
      const failed = [events, bookings, pending, users].some((x) => x.error);
      setCounts({ events: events.count || 0, bookings: bookings.count || 0, pending: pending.count || 0, users: users.count || 0 });
      setDataReady(!failed);
      if (failed) setError("الواجهة جاهزة، لكن سياسات قاعدة البيانات الحالية لا تسمح بعد بقراءة كل بيانات الإدارة. لن نعرض أرقاماً تخمينية.");
    };
    void init();
    return () => { alive = false; };
  }, [router]);

  const nav = useMemo(() => role === "supervisor"
    ? (["overview", "bookings", "payments"] as Section[])
    : role === "admin"
      ? (["overview", "events", "bookings", "payments", "users", "reports"] as Section[])
      : (["overview", "events", "bookings", "payments", "users", "reports"] as Section[]), [role]);

  const signOut = async () => { const supabase = getSupabaseBrowserClient(); if (supabase) await supabase.auth.signOut(); router.replace("/"); };

  if (loading) return <main className="admin-loading" dir="rtl"><div className="admin-spinner"/><p>جاري التحقق من صلاحياتك...</p></main>;
  if (!role) return <main className="admin-denied" dir="rtl"><Shield size={34}/><h1>الوصول غير متاح</h1><p>{error || "هذه الصفحة مخصصة لفريق إدارة حاضر."}</p><button onClick={() => router.replace("/")}>العودة للرئيسية</button></main>;

  const supervisor = role === "supervisor";
  const roleLabel = role === "owner" ? "مالك المنصة" : role === "admin" ? "مدير الإدارة" : "المشرف الإداري";
  const metrics = supervisor
    ? [{ title: "إثباتات بانتظار المراجعة", value: counts.pending, icon: ClipboardCheck }, { title: "الحجوزات", value: counts.bookings, icon: Ticket }]
    : [{ title: "الفعاليات", value: counts.events, icon: CalendarDays }, { title: "الحجوزات", value: counts.bookings, icon: Ticket }, { title: "إثباتات بانتظار المراجعة", value: counts.pending, icon: ClipboardCheck }, { title: "حسابات المستخدمين", value: counts.users, icon: Users }];

  return <main className="admin-shell" dir="rtl">
    <aside className="admin-sidebar">
      <button className="admin-brand" onClick={() => router.push("/")}><span>ح</span><b>حاضر</b><small>الإدارة</small></button>
      <div className="admin-side-caption">مساحة العمل</div>
      <nav>{nav.map((item) => <button key={item} className={section === item ? "active" : ""} onClick={() => setSection(item)}><span>{item === "overview" ? <LayoutDashboard/> : item === "events" ? <CalendarDays/> : item === "bookings" ? <Ticket/> : item === "payments" ? <Banknote/> : item === "users" ? <Users/> : <Activity/>}</span>{labels[item]}</button>)}</nav>
      <div className="admin-side-bottom"><div className="admin-mini-profile"><span>{role === "owner" ? <Shield/> : role === "admin" ? <BadgeCheck/> : <ClipboardCheck/>}</span><div><b>{name}</b><small>{roleLabel}</small></div></div><button className="admin-logout" onClick={signOut}><LogOut size={17}/> تسجيل الخروج</button></div>
    </aside>
    <section className="admin-main">
      <header className="admin-topbar"><div><span>حاضر / لوحة الإدارة</span><h1>{labels[section]}</h1></div><div className="admin-top-user"><span>{roleLabel}</span><span className="admin-avatar">{name.slice(0,1)}</span></div></header>
      <div className="admin-content">
        <div className="admin-welcome"><div><span className="admin-eyebrow">لوحة التحكم</span><h2>مرحباً، {name}</h2><p>{supervisor ? "راجع الحجوزات وإثباتات التحويل المسندة إلى فريق الإدارة." : "تابع أداء منصة حاضر وأدر عملياتها من مكان واحد."}</p></div><div className="admin-welcome-mark"><LayoutDashboard size={30}/></div></div>
        {error && <div className="admin-notice" role="status">{error}</div>}
        {section === "overview" && <>
          <div className="admin-metric-grid">{metrics.map((m) => <article className="admin-metric" key={m.title}><span><m.icon size={20}/></span><small>{m.title}</small><strong>{dataReady ? m.value.toLocaleString("ar-SD") : "—"}</strong></article>)}</div>
          <div className="admin-panel"><div className="admin-panel-head"><div><h3>{supervisor ? "المهام اليومية" : "نظرة سريعة"}</h3><p>{supervisor ? "المهام المتاحة للمشرف الإداري" : "ملخص أقسام المنصة"}</p></div></div>
            <div className="admin-shortcuts">{(supervisor ? ["bookings", "payments"] as Section[] : ["events", "bookings", "payments", "users", "reports"] as Section[]).map((item) => <button key={item} onClick={() => setSection(item)}><span>{item === "events" ? <CalendarDays/> : item === "bookings" ? <Ticket/> : item === "payments" ? <Wallet/> : item === "users" ? <Users/> : <Activity/>}</span><b>{labels[item]}</b><ArrowRight size={16}/></button>)}</div>
          </div>
        </>}
        {section !== "overview" && <div className="admin-panel admin-empty-panel"><span className="admin-empty-icon">{section === "events" ? <CalendarDays/> : section === "bookings" ? <Ticket/> : section === "payments" ? <Banknote/> : section === "users" ? <Users/> : <Activity/>}</span><h3>{labels[section]}</h3><p>{section === "payments" ? "هنا ستظهر إثباتات التحويل المرسلة، مع تفاصيل الحجز ومراجعة المشرف." : section === "bookings" ? "هنا ستظهر طلبات الحجز وحالاتها وتفاصيلها حسب صلاحيتك." : section === "events" ? "إدارة الفعاليات وتفاصيلها وأسعار التذاكر." : section === "users" ? "إدارة حسابات المستخدمين وتعيين الأدوار المسموح بها." : "تقارير الحجوزات والمبيعات وأداء المنصة."}</p><small>سيتم تفعيل بيانات هذا القسم بعد استكمال سياسات الوصول الآمن في قاعدة البيانات.</small></div>}
        <footer className="admin-footer">حاضر · نظام إدارة الفعاليات والتذاكر <span>{roleLabel}</span></footer>
      </div>
    </section>
  </main>;
}
