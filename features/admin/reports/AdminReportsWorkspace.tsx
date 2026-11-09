"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAdminReports } from "./useAdminReports";
import type { AdminReportRow } from "./admin-reports.types";

type Row = AdminReportRow;
const statusLabels: Record<string,string> = {draft:"مسودة",published:"منشورة",cancelled:"ملغاة",completed:"مكتملة",pending_payment:"بانتظار الدفع",under_review:"قيد المراجعة",confirmed:"مؤكد",rejected:"مرفوض",expired:"منتهي",submitted:"بانتظار المراجعة",approved:"مقبول",valid:"صالح",used:"مستخدم"};
const money = (value: unknown, currency = "SDG") => value == null ? "—" : `${Number(value).toLocaleString("ar-SD-u-nu-latn")} ${currency}`;

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}
function downloadEventReport(event: Row, ticketRows: Row[], bookings: Row[], confirmed: Row[], pending: Row[], rejected: Row[], people: number, currencyLines: string, commissionLines: string) {
  const rows: unknown[][] = [
    ["تقرير إحصائيات فعالية حاضر"],
    ["الفعالية", event.title],
    ["الحالة", statusLabels[event.status] || event.status],
    ["نسبة عمولة المنصة", Number(event.platform_fee_percent || 0) + "%"],
    ["تاريخ إنشاء التقرير", new Date().toLocaleString("ar-SD-u-nu-latn")],
    [],
    ["ملخص الفعالية", "القيمة"],
    ["عدد الحاجزين", people],
    ["الحجوزات المؤكدة", confirmed.length],
    ["الحجوزات المرفوضة", rejected.length],
    ["بانتظار الدفع أو المراجعة", pending.length],
    ["التذاكر المباعة", ticketRows.reduce((n,x)=>n+Number(x.sold||0),0)],
    ["التذاكر المحجوزة", ticketRows.reduce((n,x)=>n+Number(x.reserved||0),0)],
    ["إجمالي المبيعات المعتمدة", currencyLines],
    ["دخل المنصة من العمولة", commissionLines],
    [],
    ["تفاصيل فئات التذاكر"],
    ["الفئة","السعر","العملة","الإجمالي","المباع","قيد الدفع/المراجعة","المرفوض","المتبقي فعلياً","قيمة المبيعات"],
    ...ticketRows.map(t=>[t.name,t.price,t.currency,t.quantity_total??"غير محدود",t.sold,t.reserved,t.rejectedCount,t.remaining,t.revenue]),
    [],
    ["تفاصيل الحجوزات"],
    ["رقم الحجز","الحالة","البريد","الهاتف","عدد التذاكر","الإجمالي","العملة","تاريخ الحجز"],
    ...bookings.map(b=>[b.booking_number||b.id,statusLabels[b.status]||b.status,b.customer_email,b.customer_phone,(b.booking_items||[]).reduce((n:any,i:any)=>n+Number(i.quantity||0),0),b.subtotal,b.currency,b.created_at])
  ];
  const csv="\uFEFF"+rows.map(row=>row.map(csvCell).join(",")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  const safeName=String(event.title||"event").replace(/[^\p{L}\p{N}-]+/gu,"-").replace(/^-|-$/g,"")||"event";
  link.href=url;link.download="haddir-event-report-"+safeName+".csv";
  document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}


export default function AdminReportsWorkspace() {
  const { statistics, loading, error, refresh } = useAdminReports();
  const [statsView,setStatsView] = useState<"general"|"event">("general");
  const [statsEventId,setStatsEventId] = useState("");

  const renderReport = () => {
    const data=statistics;
          if(!data)return <p className="admin-no-data">جاري تجهيز الإحصائيات...</p>;
          const fmtCount=(v:number)=>v.toLocaleString("ar-SD-u-nu-latn");
          const sum=(items:Row[],field:string)=>items.reduce((n,x)=>n+Number(x[field]||0),0);
          const moneyLines=(items:Row[],field:string)=>{const grouped=new Map<string,number>();items.forEach(x=>{const c=String(x.currency||"SDG").trim();grouped.set(c,(grouped.get(c)||0)+Number(x[field]||0));});return grouped.size?Array.from(grouped.entries()).map(([c,v])=>money(v,c)).join(" · "):money(0,"SDG");};
          const confirmed=data.bookings.filter(x=>x.status==="confirmed");
          const rejected=data.bookings.filter(x=>x.status==="rejected");
          const pending=data.bookings.filter(x=>["pending_payment","under_review"].includes(x.status));
          const allTicketTypes=data.events.flatMap(e=>e.ticket_types||[]);
          const totalCapacity=sum(allTicketTypes,"quantity_total");
          const soldAttendees=sum(confirmed.flatMap(b=>b.booking_items||[]),"quantity");
          const reservedAttendees=sum(pending.flatMap(b=>b.booking_items||[]),"quantity");
          const remainingCapacity=Math.max(0,totalCapacity-sum(allTicketTypes,"quantity_sold"));
          const rejectedQty=sum(rejected.flatMap(b=>b.booking_items||[]),"quantity");
          const currentEvents=data.events.filter(e=>e.status==="published"&&(!e.ends_at||new Date(e.ends_at).getTime()>=Date.now()));
          const pastEvents=data.events.filter(e=>e.status==="completed"||(!!e.ends_at&&new Date(e.ends_at).getTime()<Date.now()));
          const roleCounts=(r:string)=>data.profiles.filter(p=>p.role===r||(r==="gatekeeper"&&p.role==="organizer")).length;
          const revenueRows=confirmed.map(b=>({currency:b.currency,value:Number(b.subtotal||0)}));
          const commissionRows=confirmed.map(b=>({currency:b.currency,value:Math.round((Number(b.subtotal||0)*Number(data.events.find(e=>e.id===b.event_id)?.platform_fee_percent||0)/100)*100)/100}));
          const event=data.events.find(e=>e.id===statsEventId);
          const eventBookings=event?data.bookings.filter(b=>b.event_id===event.id):[];
          const eventConfirmed=eventBookings.filter(b=>b.status==="confirmed");
          const eventPending=eventBookings.filter(b=>["pending_payment","under_review"].includes(b.status));
          const eventRejected=eventBookings.filter(b=>b.status==="rejected");
          const eventPeople=new Set(eventBookings.filter(b=>!["rejected","cancelled","expired"].includes(b.status)).map(b=>b.user_id||b.customer_email||b.customer_phone||b.id)).size;
          const eventTicketRows=(event?.ticket_types||[]).map((type:Row)=>{
            const items=eventConfirmed.flatMap(b=>b.booking_items||[]).filter((i:any)=>i.ticket_type_id===type.id);
            const reservedItems=eventPending.flatMap(b=>b.booking_items||[]).filter((i:any)=>i.ticket_type_id===type.id);
            const rejectedItems=eventRejected.flatMap(b=>b.booking_items||[]).filter((i:any)=>i.ticket_type_id===type.id);
            const sold=sum(items,"quantity");
            const reserved=sum(reservedItems,"quantity");
            const inventoryUsed=Number(type.quantity_sold??(sold+reserved));
            const revenue=items.reduce((n,i:any)=>n+Number(i.line_total||Number(i.unit_price||0)*Number(i.quantity||0)),0);
            return {...type,sold,reserved,rejectedCount:sum(rejectedItems,"quantity"),revenue,remaining:Math.max(0,Number(type.quantity_total||0)-inventoryUsed)};
          });
          const eventRevenueRows=eventConfirmed.flatMap(b=>(b.booking_items||[]).map((i:any)=>({currency:i.ticket_types?.currency||b.currency,value:Number(i.line_total||Number(i.unit_price||0)*Number(i.quantity||0))})));
          const eventCommissionRows=eventRevenueRows.map(x=>({currency:x.currency,value:Math.round((x.value*Number(event?.platform_fee_percent||0)/100)*100)/100}));
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
              {metricCards([{title:"إجمالي سعة التذاكر",value:totalCapacity},{title:"الأشخاص في التذاكر المؤكدة",value:soldAttendees},{title:"رموز الدخول المستخدمة",value:data.tickets.filter(t=>t.status==="used").length},{title:"محجوزة قيد الدفع/المراجعة",value:reservedAttendees},{title:"التذاكر المتاحة فعلياً",value:remainingCapacity},{title:"ضمن حجوزات مرفوضة",value:rejectedQty},{title:"إجمالي الحجوزات",value:data.bookings.length},{title:"الحجوزات المؤكدة",value:confirmed.length},{title:"الحجوزات المرفوضة",value:rejected.length},{title:"بانتظار الدفع/المراجعة",value:pending.length}])}
              <h3 className="admin-stats-heading">المبيعات وأرباح المنصة</h3>
              {metricCards([{title:"إجمالي المبيعات المعتمدة",value:moneyLines(revenueRows,"value")},{title:"صافي دخل المنصة (العمولة)",value:moneyLines(commissionRows,"value"),hint:"حسب نسبة العمولة لكل فعالية، قبل المصروفات التشغيلية"}])}
              <h3 className="admin-stats-heading">ملخص كل فعالية</h3>
              <div className="admin-table-wrap"><table className="admin-data-table"><thead><tr><th>الفعالية</th><th>الحالة</th><th>الحجوزات</th><th>التذاكر المؤكدة</th><th>قيد الدفع/المراجعة</th><th>السعة</th><th>المتبقي فعلياً</th><th>المبيعات المعتمدة</th><th>دخل المنصة</th></tr></thead><tbody>{data.events.map(e=>{const eb=data.bookings.filter(b=>b.event_id===e.id);const ec=eb.filter(b=>b.status==="confirmed");const issued=sum(ec.flatMap(b=>b.booking_items||[]),"quantity");const ep=eb.filter(b=>["pending_payment","under_review"].includes(b.status));const reserved=sum(ep.flatMap(b=>b.booking_items||[]),"quantity");const sales=ec.map(b=>({currency:b.currency,value:Number(b.subtotal||0)}));const fees=ec.map(b=>({currency:b.currency,value:Math.round((Number(b.subtotal||0)*Number(e.platform_fee_percent||0)/100)*100)/100}));const caps=e.ticket_types||[];return <tr key={e.id}><td>{e.title}</td><td>{statusLabels[e.status]||e.status}</td><td>{fmtCount(eb.length)}</td><td>{fmtCount(issued)}</td><td>{fmtCount(reserved)}</td><td>{fmtCount(sum(caps,"quantity_total"))}</td><td>{fmtCount(Math.max(0,sum(caps,"quantity_total")-sum(caps,"quantity_sold")))}</td><td>{moneyLines(sales,"value")}</td><td>{moneyLines(fees,"value")}</td></tr>;})}</tbody></table></div>
              <p className="admin-stats-note">المبيعات تشمل الحجوزات المؤكدة فقط. دخل المنصة هو قيمة العمولة المحسوبة من نسبة كل فعالية، قبل المصروفات التشغيلية. الطلبات المرفوضة والمعلقة لا تدخل في الإيرادات.</p>
            </>:<>
              <div className="admin-event-stat-select"><label htmlFor="stats-event-select">اختار الفعالية</label><select id="stats-event-select" value={statsEventId} onChange={e=>setStatsEventId(e.target.value)}><option value="">اختر فعالية...</option>{data.events.map(e=><option key={e.id} value={e.id}>{e.title} — {statusLabels[e.status]||e.status}</option>)}</select></div>
              {!event?<p className="admin-no-data">اختار فعالية عشان تظهر إحصائياتها.</p>:<>
                <div className="admin-selected-event"><div><small>الفعالية المحددة</small><h3>{event.title}</h3><span>{statusLabels[event.status]||event.status} · عمولة المنصة {Number(event.platform_fee_percent||0)}%</span></div><button className="admin-print-button" type="button" onClick={()=>downloadEventReport(event,eventTicketRows,eventBookings,eventConfirmed,eventPending,eventRejected,eventPeople,moneyLines(eventRevenueRows,"value"),moneyLines(eventCommissionRows,"value"))}>تحميل تقرير الفعالية (CSV)</button></div>
                <div className="admin-print-report-head"><b>حاضِر · تقرير إحصائيات فعالية</b><h2>{event.title}</h2><p>الحالة: {statusLabels[event.status]||event.status} · عمولة المنصة: {Number(event.platform_fee_percent||0)}% · تاريخ التقرير: {new Date().toLocaleString("ar-SD-u-nu-latn")}</p></div>
                {metricCards([{title:"عدد الحاجزين",value:eventPeople},{title:"الحجوزات المؤكدة",value:eventConfirmed.length},{title:"الحجوزات المرفوضة",value:eventRejected.length},{title:"إجمالي سعة التذاكر",value:sum(eventTicketRows,"quantity_total")},{title:"التذاكر المباعة",value:sum(eventTicketRows,"sold")},{title:"محجوزة قيد الدفع/المراجعة",value:sum(eventTicketRows,"reserved")},{title:"التذاكر المرفوضة",value:sum(eventTicketRows,"rejectedCount")},{title:"التذاكر المتاحة فعلياً",value:sum(eventTicketRows,"remaining")},{title:"إجمالي المبيعات",value:moneyLines(eventRevenueRows,"value")},{title:"صافي دخل المنصة (العمولة)",value:moneyLines(eventCommissionRows,"value"),hint:Number(event.platform_fee_percent||0)===0?"لا توجد عمولة مستحقة على هذه الفعالية":"محسوبة من المبيعات المعتمدة فقط"}])}
                <h3 className="admin-stats-heading">تفاصيل فئات التذاكر</h3>
                <div className="admin-table-wrap"><table className="admin-data-table"><thead><tr><th>الفئة</th><th>السعر</th><th>الإجمالي</th><th>المباع</th><th>قيد الدفع/المراجعة</th><th>المرفوض</th><th>المتبقي فعلياً</th><th>قيمة المبيعات</th></tr></thead><tbody>{eventTicketRows.map((t:Row)=><tr key={t.id}><td>{t.name}</td><td>{money(t.price,t.currency)}</td><td>{fmtCount(Number(t.quantity_total||0))}</td><td>{fmtCount(t.sold)}</td><td>{fmtCount(t.reserved)}</td><td>{fmtCount(t.rejectedCount)}</td><td>{fmtCount(t.remaining)}</td><td>{money(t.revenue,t.currency)}</td></tr>)}</tbody></table></div>
              </>}
            </>}
          </div>;
  };

  return <section className="admin-panel">
    <div className="admin-panel-head"><div><h3>الإحصائيات والتقارير</h3><p>ملخص أداء الفعاليات والمبيعات والحجوزات والمستخدمين</p></div><button className="admin-refresh" type="button" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={16}/> تحديث</button></div>
    {error&&<div className="admin-notice" role="alert">{error}</div>}
    {loading?<p className="admin-no-data">جاري تجهيز الإحصائيات...</p>:renderReport()}
  </section>;
}
