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
import { ADMIN_ROLE_LABELS, ADMIN_SECTION_LABELS, getAdminNavigationSections, type AdminSection } from "../types";
import { useAdminAccess } from "../hooks/useAdminAccess";


export default function AdminPage() {
  const router = useRouter();
  const { role, name, avatarUrl, loading, error } = useAdminAccess();
  const [section, setAdminSection] = useState<AdminSection>("overview");
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

  const nav = useMemo(() => role ? getAdminNavigationSections(role) : [], [role]);

  const signOut = () => setShowLogoutConfirm(true);
  const confirmSignOut = async () => { setShowLogoutConfirm(false); const supabase = getSupabaseBrowserClient(); if (supabase) await supabase.auth.signOut(); router.replace("/"); };

  if (loading) return <main className={"admin-loading"+(darkMode?" theme-dark":"")} dir="rtl"><div className="admin-spinner"/><p>جاري التحقق من صلاحياتك...</p></main>;
  if (!role) return <main className={"admin-denied"+(darkMode?" theme-dark":"")} dir="rtl"><Shield size={34}/><h1>الوصول غير متاح</h1><p>{error || "هذه الصفحة مخصصة لفريق إدارة حاضر."}</p><button onClick={() => router.replace("/")}>العودة للرئيسية</button></main>;

  const supervisor = role === "supervisor";
  const roleLabel = ADMIN_ROLE_LABELS[role];
  return <main className={"admin-shell"+(darkMode?" theme-dark":"")} dir="rtl">
    <aside className="admin-sidebar">
      <button className="admin-brand" onClick={() => router.push("/")}><img src={darkMode?"/dark.svg":"/light.svg"} alt="حاضر"/><small>الإدارة</small></button>
      <div className="admin-side-caption">مساحة العمل</div>
      <nav aria-label="تبويبات لوحة الإدارة">{nav.map(item=><button key={item} className={section===item?"active":""} onClick={()=>setAdminSection(item)}><span>{item==="overview"?<LayoutDashboard/>:item==="events"?<CalendarDays/>:item==="bookings"?<Ticket/>:item==="payments"?<Banknote/>:item==="users"?<Users/>:<Activity/>}</span>{ADMIN_SECTION_LABELS[item]}</button>)}</nav>
      <div className="admin-side-bottom"><div className="admin-mini-profile"><span className="admin-mini-avatar">{avatarUrl?<img src={avatarUrl} alt="صورة الحساب"/>:role==="owner"?<Shield/>:role==="admin"?<BadgeCheck/>:<ClipboardCheck/>}</span><div><b>{name}</b><small>{roleLabel}</small></div></div><button className="admin-logout" onClick={signOut}><LogOut size={17}/> تسجيل الخروج</button></div>
    </aside>
    <section className="admin-main">
      <header className="admin-topbar"><div><span>حاضر / لوحة الإدارة</span><h1>{ADMIN_SECTION_LABELS[section]}</h1></div><div className="admin-top-user"><span>{roleLabel}</span><span className="admin-avatar">{avatarUrl?<img src={avatarUrl} alt="صورة حساب Google"/>:name.slice(0,1)}</span></div></header>
      <div className="admin-content">
        <div className="admin-welcome"><div><span className="admin-eyebrow">لوحة التحكم</span><h2>مرحباً، {name}</h2><p>{supervisor?"راجع الحجوزات وإثباتات التحويل.":"تابع أداء منصة حاضر وأدر عملياتها من مكان واحد."}</p></div><div className="admin-welcome-mark"><LayoutDashboard size={30}/></div></div>
        {error&&<div className="admin-notice" role="status">{error}</div>}
        <div key={section} className="admin-section-transition">
          {section==="overview"&&<AdminOverviewWorkspace role={role} onNavigate={setAdminSection}/>}
          {section==="events"?<AdminEventsWorkspace role={role}/>:section==="bookings"?<AdminBookingsWorkspace/>:section==="payments"?<AdminPaymentsWorkspace/>:section==="users"?<AdminUsersWorkspace role={role} searchTerm={userSearchTerm} onSearchTermChange={setUserSearchTerm}/>:section==="activity"?<AdminActivityWorkspace/>:section==="reports"?<AdminReportsWorkspace/>:null}
        </div>
        <footer className="admin-footer">حاضر · نظام إدارة الفعاليات والتذاكر <span>{roleLabel}</span></footer>
      </div>
    </section>
    {showLogoutConfirm&&<HaddirDialog open title="تسجيل الخروج من لوحة التحكم؟" description="هل تريد إنهاء جلسة فريق الإدارة والعودة إلى واجهة حاضر؟" confirmLabel="تسجيل الخروج" onConfirm={confirmSignOut} onCancel={()=>setShowLogoutConfirm(false)}/>}
  </main>;
}
