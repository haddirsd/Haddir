"use client";

import { ChevronLeft, Ticket } from "lucide-react";
import { formatEventDate, formatMoney } from "../events/events.formatters";
import { useAdvertiserStatistics } from "./useAdvertiserStatistics";

type AuthUser = { id: string; email?: string } | null;

export default function AdvertiserWorkspace({
  authUser, userRole,
}: { authUser: AuthUser; userRole: string }) {
  const { show, statistics, loading, error, open, close } = useAdvertiserStatistics(authUser, userRole);
  if (!authUser || userRole !== "advertiser") return null;

  return <div className="advertiser-profile-stats">
    <button type="button" className="role-workspace-button" onClick={()=>void open()}>
      <span className="role-workspace-icon"><Ticket size={21}/></span>
      <span><strong>تفاصيل الفعالية</strong><small>عرض المبيعات والتذاكر والمستحقات للفعالية المرتبطة بك</small></span>
      <ChevronLeft size={18}/>
    </button>
    {show&&<div className="advertiser-statistics-panel">
      <div className="advertiser-stats-heading"><div><small>لوحة المعلن</small><h2>إحصائيات فعاليتك</h2></div><button type="button" className="btn btn-outline" onClick={close}>إغلاق</button></div>
      {loading?<div className="empty-state">جاري تحميل الإحصائيات...</div>:error?<div className="empty-state" role="alert">{error}</div>:statistics&&<>
        <article className="advertiser-event-summary"><small>الفعالية المرتبطة بحسابك فقط</small><h3>{statistics.event.title}</h3><p>{statistics.event.venue||statistics.event.city||"الموقع غير محدد"} · {statistics.event.starts_at?formatEventDate(statistics.event.starts_at):"—"}</p></article>
        <div className="advertiser-metric-grid">
          <article><small>الحاجزون المعتمدون</small><strong>{Number(statistics.totals?.bookers||0).toLocaleString("ar-SD")}</strong></article>
          <article><small>الحجوزات المؤكدة</small><strong>{Number(statistics.totals?.confirmed_bookings||0).toLocaleString("ar-SD")}</strong></article>
          <article><small>الحجوزات المرفوضة</small><strong>{Number(statistics.totals?.rejected_bookings||0).toLocaleString("ar-SD")}</strong></article>
          <article><small>التذاكر المباعة</small><strong>{Number(statistics.totals?.confirmed_tickets||0).toLocaleString("ar-SD")}</strong></article>
          <article><small>التذاكر ضمن طلبات مرفوضة</small><strong>{Number(statistics.totals?.rejected_tickets||0).toLocaleString("ar-SD")}</strong></article>
        </div>
        <h3 className="advertiser-stats-subtitle">ملخص المبيعات والمستحقات</h3>
        {(statistics.financials||[]).length?(statistics.financials||[]).map(line=><article className="advertiser-finance-card" key={line.currency}>
          <div><small>إجمالي المبيعات المعتمدة</small><strong>{formatMoney(Number(line.sales||0),line.currency)}</strong></div>
          {Number(statistics.event.platform_fee_percent||0)>0&&<div><small>عمولة حاضر ({Number(statistics.event.platform_fee_percent)}%)</small><strong>{formatMoney(Number(line.platform_fee||0),line.currency)}</strong></div>}
          <div className="advertiser-net"><small>صافي مستحقات المعلن</small><strong>{formatMoney(Number(line.advertiser_net||0),line.currency)}</strong></div>
        </article>):<article className="advertiser-finance-card">
          <div><small>إجمالي المبيعات المعتمدة</small><strong>{formatMoney(0)}</strong></div>
          {Number(statistics.event.platform_fee_percent||0)>0&&<div><small>عمولة حاضر ({Number(statistics.event.platform_fee_percent)}%)</small><strong>{formatMoney(0)}</strong></div>}
          <div className="advertiser-net"><small>صافي مستحقات المعلن</small><strong>{formatMoney(0)}</strong></div>
        </article>}
        <h3 className="advertiser-stats-subtitle">تفاصيل فئات التذاكر</h3>
        <div className="advertiser-ticket-table"><table><thead><tr><th>الفئة</th><th>السعة</th><th>المباع</th><th>محجوز مؤقتاً</th><th>المرفوض</th><th>المتاح للبيع</th><th>المبيعات</th></tr></thead><tbody>{(statistics.ticket_types||[]).map(ticket=><tr key={ticket.id}><td>{ticket.name}</td><td>{Number(ticket.quantity_total||0).toLocaleString("ar-SD")}</td><td>{Number(ticket.confirmed_quantity||0).toLocaleString("ar-SD")}</td><td>{Number(ticket.reserved_quantity||0).toLocaleString("ar-SD")}</td><td>{Number(ticket.rejected_quantity||0).toLocaleString("ar-SD")}</td><td>{Number(ticket.remaining_quantity||0).toLocaleString("ar-SD")}</td><td>{formatMoney(Number(ticket.sales||0),ticket.currency)}</td></tr>)}</tbody></table></div>
        <p className="advertiser-stats-note">المبيعات والتذاكر المباعة محسوبة من الحجوزات المؤكدة فقط. المتاح للبيع يستبعد الحجوزات النشطة قيد الدفع أو المراجعة. صافي المستحقات يساوي المبيعات بعد خصم عمولة حاضر، ولا يشمل مصروفات تشغيلية أو تسويات خارج المنصة.</p>
      </>}
    </div>}
  </div>;
}
