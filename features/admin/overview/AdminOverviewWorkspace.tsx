"use client";

import { Activity, ArrowRight, CalendarDays, ClipboardCheck, RefreshCw, Ticket, Users, Wallet } from "lucide-react";
import { useAdminOverview } from "./useAdminOverview";
import type { AdminOverviewRole } from "./admin-overview.types";

type Section = "events" | "bookings" | "payments" | "users" | "reports";
export default function AdminOverviewWorkspace({
  role, onNavigate,
}: { role: AdminOverviewRole; onNavigate: (section: Section) => void }) {
  const { stats, loading, error, refresh } = useAdminOverview(role);
  const supervisor = role === "supervisor";
  const metrics = supervisor
    ? [{ title: "إثباتات بانتظار المراجعة", value: stats.pending, icon: ClipboardCheck }, { title: "الحجوزات", value: stats.bookings, icon: Ticket }]
    : [{ title: "الفعاليات", value: stats.events, icon: CalendarDays }, { title: "الحجوزات", value: stats.bookings, icon: Ticket }, { title: "إثباتات بانتظار المراجعة", value: stats.pending, icon: ClipboardCheck }, { title: "حسابات المستخدمين", value: stats.users, icon: Users }];
  const shortcuts: Section[] = supervisor ? ["bookings", "payments"] : ["events", "bookings", "payments", "users", "reports"];
  const labels: Record<Section,string> = { events:"الفعاليات", bookings:"الحجوزات", payments:"مراجعة المدفوعات", users:"المستخدمون", reports:"الإحصائيات" };
  const number = (value:number) => loading ? "—" : value.toLocaleString("ar-SD");

  return <section className="admin-overview-workspace">
    <div className="admin-panel-head"><div><h3>{supervisor?"المهام اليومية":"نظرة سريعة"}</h3><p>بيانات مباشرة من قاعدة بيانات حاضر</p></div><button className="admin-refresh" type="button" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={16}/> تحديث</button></div>
    {error&&<div className="admin-notice" role="alert">{error}</div>}
    <div className="admin-metric-grid">{metrics.map(metric=><article className="admin-metric" key={metric.title}><span><metric.icon size={20}/></span><small>{metric.title}</small><strong>{number(metric.value)}</strong></article>)}</div>
    <div className="admin-panel"><div className="admin-panel-head"><div><h3>اختصارات الإدارة</h3><p>انتقل مباشرة إلى مساحة العمل المطلوبة</p></div></div><div className="admin-shortcuts">{shortcuts.map(item=><button key={item} onClick={()=>onNavigate(item)}><span>{item==="events"?<CalendarDays/>:item==="bookings"?<Ticket/>:item==="payments"?<Wallet/>:item==="users"?<Users/>:<Activity/>}</span><b>{labels[item]}</b><ArrowRight size={16}/></button>)}</div></div>
  </section>;
}
