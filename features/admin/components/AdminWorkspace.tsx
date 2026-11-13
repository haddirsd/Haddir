"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../../lib/supabase";
import AdminEventsWorkspace from "../../events/admin/AdminEventsWorkspace";
import AdminBookingsWorkspace from "../../booking/admin/AdminBookingsWorkspace";
import AdminPaymentsWorkspace from "../../booking/admin/AdminPaymentsWorkspace";
import AdminUsersWorkspace from "../../users/admin/AdminUsersWorkspace";
import AdminActivityWorkspace from "../activity/AdminActivityWorkspace";
import AdminReportsWorkspace from "../reports/AdminReportsWorkspace";
import AdminOverviewWorkspace from "../overview/AdminOverviewWorkspace";
import { Activity, BadgeCheck, Banknote, CalendarDays, ClipboardCheck, LayoutDashboard, LogOut, Shield, Ticket, Users } from "lucide-react";
import { HaddirDialog } from "../../../components/ui/HaddirDialog";

type AdminRole = "owner" | "admin" | "supervisor";
type Section = "overview" | "events" | "bookings" | "payments" | "users" | "reports" | "activity";
const labels: Record<Section, string> = { overview: "نظرة عامة", events: "الفعاليات", bookings: "الحجوزات", payments: "مراجعة المدفوعات", users: "المستخدمون", reports: "الإحصائيات", activity: "سجل الإجراءات" };

export default function AdminPage() {
  const router = useRouter();
  const [role, setRole] = useState<AdminRole | null>(null);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [section, setSection] = useState<Section>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userSearchTerm,setUserSearchTerm]=useState("");
  const [darkMode,setDarkMode]=useState(false);
  const [showLogoutConfirm,setShowLogoutConfirm]=useState(false);

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
      const metadata = user.user_metadata || {};
      setName(profile.full_name || metadata.full_name || metadata.name || user.email || "فريق حاضر");
      setAvatarUrl(String(metadata.avatar_url || metadata.picture || metadata.photo_url || ""));
      setLoading(false);
    };
    void init();
    return () => { alive = false; };
  }, [router]);

  const nav = useMemo(() => role === "supervisor" ? (["overview","bookings","payments"] as Section[]) : (["overview","events","bookings","payments","users","reports","activity"] as Section[]), [role]);

  const signOut = () => setShowLogoutConfirm(true);
  const confirmSignOut = async () => { setShowLogoutConfirm(false); const supabase = getSupabaseBrowserClient(); if (supabase) await supabase.auth.signOut(); router.replace("/"); };

  if (loading) return <main className={"admin-loading"+(darkMode?" theme-dark":"")} dir="rtl"><div className="admin-spinner"/><p>جاري التحقق من صلاحياتك...</p></main>;
  if (!role) return <main className={"admin-denied"+(darkMode?" theme-dark":"")} dir="rtl"><Shield size={34}/><h1>الوصول غير متاح</h1><p>{error || "هذه الصفحة مخصصة لفريق إدارة حاضر."}</p><button onClick={() => router.replace("/")}>العودة للرئيسية</button></main>;

  const supervisor = role === "supervisor";
  const roleLabel = role === "owner" ? "مالك المنصة" : role === "admin" ? "المشرف الإداري" : "موظف حاضر";
  return <main className={"admin-shell"+(darkMode?" theme-dark":"")} dir="rtl">
    <aside className="admin-sidebar">
      <button className="admin-brand" onClick={() => router.push("/")}><img src={darkMode?"/dark.svg":"/light.svg"} alt="حاضر"/><small>الإدارة</small></button>
      <div className="admin-side-caption">مساحة العمل</div>
      <nav aria-label="تبويبات لوحة الإدارة">{nav.map(item=><button key={item} className={section===item?"active":""} onClick={()=>setSection(item)}><span>{item==="overview"?<LayoutDashboard/>:item==="events"?<CalendarDays/>:item==="bookings"?<Ticket/>:item==="payments"?<Banknote/>:item==="users"?<Users/>:<Activity/>}</span>{labels[item]}</button>)}</nav>
      <div className="admin-side-bottom"><div className="admin-mini-profile"><span className="admin-mini-avatar">{avatarUrl?<img src={avatarUrl} alt="صورة الحساب"/>:role==="owner"?<Shield/>:role==="admin"?<BadgeCheck/>:<ClipboardCheck/>}</span><div><b>{name}</b><small>{roleLabel}</small></div></div><button className="admin-logout" onClick={signOut}><LogOut size={17}/> تسجيل الخروج</button></div>
    </aside>
    <section className="admin-main">
      <header className="admin-topbar"><div><span>حاضر / لوحة الإدارة</span><h1>{labels[section]}</h1></div><div className="admin-top-user"><span>{roleLabel}</span><span className="admin-avatar">{avatarUrl?<img src={avatarUrl} alt="صورة حساب Google"/>:name.slice(0,1)}</span></div></header>
      <div className="admin-content">
        <div className="admin-welcome"><div><span className="admin-eyebrow">لوحة التحكم</span><h2>مرحباً، {name}</h2><p>{supervisor?"راجع الحجوزات وإثباتات التحويل.":"تابع أداء منصة حاضر وأدر عملياتها من مكان واحد."}</p></div><div className="admin-welcome-mark"><LayoutDashboard size={30}/></div></div>
        {error&&<div className="admin-notice" role="status">{error}</div>}
        <div key={section} className="admin-section-transition">
          {section==="overview"&&<AdminOverviewWorkspace role={role} onNavigate={setSection}/>}
          {section==="events"?<AdminEventsWorkspace role={role}/>:section==="bookings"?<AdminBookingsWorkspace/>:section==="payments"?<AdminPaymentsWorkspace/>:section==="users"?<AdminUsersWorkspace role={role} searchTerm={userSearchTerm} onSearchTermChange={setUserSearchTerm}/>:section==="activity"?<AdminActivityWorkspace/>:section==="reports"?<AdminReportsWorkspace/>:null}
        </div>
        <footer className="admin-footer">حاضر · نظام إدارة الفعاليات والتذاكر <span>{roleLabel}</span></footer>
      </div>
    </section>
    {showLogoutConfirm&&<HaddirDialog open title="تسجيل الخروج من لوحة التحكم؟" description="هل تريد إنهاء جلسة فريق الإدارة والعودة إلى واجهة حاضر؟" confirmLabel="تسجيل الخروج" onConfirm={confirmSignOut} onCancel={()=>setShowLogoutConfirm(false)}/>}
  </main>;
}
