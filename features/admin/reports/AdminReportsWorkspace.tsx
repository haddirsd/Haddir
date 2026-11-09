"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAdminReports } from "./useAdminReports";
import type { AdminReportRow } from "./admin-reports.types";

type Row = AdminReportRow;
const statusLabels: Record<string,string> = {draft:"مسودة",published:"منشورة",cancelled:"ملغاة",completed:"مكتملة",pending_payment:"بانتظار الدفع",under_review:"قيد المراجعة",confirmed:"مؤكد",rejected:"مرفوض",expired:"منتهي",submitted:"بانتظار المراجعة",approved:"مقبول",valid:"صالح",used:"مستخدم"};
const money = (value: unknown, currency = "SDG") => value == null ? "—" : `${Number(value).toLocaleString("ar-SD-u-nu-latn")} ${currency}`;

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
          const eventTickets=data.tickets.filter(t=>t.event_id===event?.id);\n          const checkedInTickets=eventTickets.filter(t=>t.status==="used");\n\n          const eventTicketRows=(event?.ticket_types||[]).map((type:Row)=>{
            const items=eventConfirmed.flatMap(b=>b.booking_items||[]).filter((i:any)=>i.ticket_type_id===type.id);
            const reservedItems=eventPending.flatMap(b=>b.booking_items||[]).filter((i:any)=>i.ticket_type_id===type.id);
            const rejectedItems=eventRejected.flatMap(b=>b.booking_items||[]).filter((i:any)=>i.ticket_type_id===type.id);
            const sold=sum(items,"quantity");
            const reserved=sum(reservedItems,"quantity");
            const inventoryUsed=Number(type.quantity_sold??(sold+reserved));
            const revenue=items.reduce((n,i:any)=>n+Number(i.line_total||Number(i.unit_price||0)*Number(i.quantity||0)),0);
            return {...type,sold,reserved,rejectedCount:sum(rejectedItems,"quantity"),revenue,remaining:type.quantity_total==null?"غير محدود":Math.max(0,Number(type.quantity_total)-inventoryUsed)};
          });
          const eventRevenueRows=eventConfirmed.flatMap(b=>(b.booking_items||[]).map((i:any)=>({currency:i.ticket_types?.currency||b.currency,value:Number(i.line_total||Number(i.unit_price||0)*Number(i.quantity||0))})));
          const eventCommissionRows=eventRevenueRows.map(x=>({currency:x.currency,value:Math.round((x.value*Number(event?.platform_fee_percent||0)/100)*100)/100}));
          const eventNetRows=eventRevenueRows.map(x=>({currency:x.currency,value:x.value*(1-Number(event?.platform_fee_percent||0)/100)}));
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
                <div className="admin-selected-event"><div><small>الفعالية المحددة</small><h3>{event.title}</h3><span>{statusLabels[event.status]||event.status} · عمولة المنصة {Number(event.platform_fee_percent||0)}%</span></div><button className="admin-print-button" type="button" onClick={()=>window.print()}>تحميل تقرير الفعالية PDF</button></div>
                <div className="admin-event-report" dir="rtl">
                  <section className="admin-report-page admin-report-cover">
                    <div className="admin-report-topline"><img src="/haddir_for_ticket.svg" alt="حاضر" /><span>حاضِر · منصة الفعاليات</span><small>تقرير فعالية تفصيلي</small></div>
                    {event.cover_image_url&&<img className="admin-report-cover-image" src={event.cover_image_url} alt="" />}
                    <div className="admin-report-cover-content">
                      <span className="admin-report-kicker">تقرير الأداء والتشغيل</span>
                      <h1>{event.title}</h1>
                      <p>{event.description||"تقرير تفصيلي لأداء الفعالية والحجوزات والمبيعات والدخول."}</p>
                      <div className="admin-report-meta-grid">
                        <div><small>التصنيف</small><b>{event.category||"غير محدد"}</b></div>
                        <div><small>الموقع</small><b>{[event.venue,event.city].filter(Boolean).join(" · ")||"غير محدد"}</b></div>
                        <div><small>موعد الفعالية</small><b>{event.is_continuous?"فعالية مستمرة":event.starts_at?new Date(event.starts_at).toLocaleString("ar-SD-u-nu-latn"):"غير محدد"}</b></div>
                        <div><small>الحالة</small><b>{statusLabels[event.status]||event.status}</b></div>
                        <div><small>نسبة عمولة المنصة</small><b>{Number(event.platform_fee_percent||0)}%</b></div>
                        <div><small>تاريخ إصدار التقرير</small><b>{new Date().toLocaleDateString("ar-SD-u-nu-latn")}</b></div>
                      </div>
                    </div>
                    <div className="admin-report-footer"><span>مستند إداري · للاستخدام الداخلي</span><b>01</b></div>
                  </section>

                  <section className="admin-report-page">
                    <div className="admin-report-section-head"><span>01 / الملخص التنفيذي</span><h2>نظرة عامة على الأداء</h2><p>ملخص الحجوزات، أعداد التذاكر، المبيعات، ومؤشرات الدخول.</p></div>
                    <div className="admin-report-kpi-grid">
                      <article><small>عدد الحاجزين</small><strong>{fmtCount(eventPeople)}</strong><span>حجوزات غير مرفوضة أو ملغاة أو منتهية</span></article>
                      <article><small>الحجوزات المؤكدة</small><strong>{fmtCount(eventConfirmed.length)}</strong><span>حجوزات تم اعتمادها</span></article>
                      <article><small>قيد الدفع / المراجعة</small><strong>{fmtCount(eventPending.length)}</strong><span>طلبات لم تكتمل مراجعتها</span></article>
                      <article><small>الحجوزات المرفوضة</small><strong>{fmtCount(eventRejected.length)}</strong><span>طلبات لم يتم اعتمادها</span></article>
                      <article><small>التذاكر المصدرة</small><strong>{fmtCount(eventTickets.length)}</strong><span>إجمالي رموز الدخول</span></article>
                      <article><small>تم تسجيل الدخول</small><strong>{fmtCount(checkedInTickets.length)}</strong><span>{eventTickets.length?Math.round(checkedInTickets.length/eventTickets.length*100):0}% من التذاكر المصدرة</span></article>
                    </div>
                    <div className="admin-report-highlight">
                      <div><small>إجمالي المبيعات المعتمدة</small><strong>{moneyLines(eventRevenueRows,"value")}</strong></div>
                      <div><small>عمولة منصة حاضر</small><strong>{moneyLines(eventCommissionRows,"value")}</strong></div>
                      <div><small>صافي مستحق منظم الفعالية</small><strong>{moneyLines(eventNetRows,"value")}</strong></div>
                    </div>
                    <h3 className="admin-report-subtitle">حالة التذاكر والدخول</h3>
                    <div className="admin-report-status-list">
                      <div><span>صالحة ولم تستخدم</span><b>{fmtCount(eventTickets.filter(t=>t.status==="valid").length)}</b></div>
                      <div><span>تم استخدامها عند البوابة</span><b>{fmtCount(checkedInTickets.length)}</b></div>
                      <div><span>غير صالحة / ملغاة</span><b>{fmtCount(eventTickets.filter(t=>!["valid","used"].includes(t.status)).length)}</b></div>
                      <div><span>إجمالي الكمية المحجوزة قيد المراجعة</span><b>{fmtCount(sum(eventTicketRows,"reserved"))}</b></div>
                    </div>
                    <p className="admin-report-note">تُحتسب المبيعات من الحجوزات المؤكدة فقط. صافي المنظم هو المبيعات المعتمدة بعد خصم عمولة المنصة، ولا يشمل المصروفات التشغيلية أو التسويات الخارجية.</p>
                    <div className="admin-report-footer"><span>حاضِر · تقرير الفعالية</span><b>02</b></div>
                  </section>

                  <section className="admin-report-page">
                    <div className="admin-report-section-head"><span>02 / تفاصيل المبيعات</span><h2>فئات التذاكر والأداء المالي</h2><p>تفصيل السعة والبيع والحجوزات المعلقة والإيراد حسب كل فئة.</p></div>
                    <div className="admin-report-table-wrap"><table><thead><tr><th>فئة التذكرة</th><th>السعر</th><th>السعة</th><th>المباع</th><th>قيد المراجعة</th><th>المتبقي</th><th>المبيعات</th></tr></thead><tbody>{eventTicketRows.map((t:Row)=><tr key={t.id}><td><b>{t.name}</b>{t.description&&<small>{t.description}</small>}</td><td>{money(t.price,t.currency)}</td><td>{t.quantity_total==null?"غير محدود":fmtCount(Number(t.quantity_total))}</td><td>{fmtCount(t.sold)}</td><td>{fmtCount(t.reserved)}</td><td>{t.remaining==="غير محدود"?"غير محدود":fmtCount(Number(t.remaining))}</td><td>{money(t.revenue,t.currency)}</td></tr>)}</tbody></table></div>
                    <div className="admin-report-finance-grid">
                      <div><small>إجمالي المبيعات</small><b>{moneyLines(eventRevenueRows,"value")}</b></div>
                      <div><small>نسبة العمولة</small><b>{Number(event.platform_fee_percent||0)}%</b></div>
                      <div><small>دخل المنصة</small><b>{moneyLines(eventCommissionRows,"value")}</b></div>
                      <div><small>صافي المنظم</small><b>{moneyLines(eventNetRows,"value")}</b></div>
                    </div>
                    <div className="admin-report-footer"><span>حاضِر · تقرير الفعالية</span><b>03</b></div>
                  </section>

                  <section className="admin-report-page admin-report-register">
                    <div className="admin-report-section-head"><span>03 / سجل الحجوزات</span><h2>تفاصيل طلبات الحجز</h2><p>سجل تفصيلي للحجوزات المرتبطة بهذه الفعالية.</p></div>
                    <div className="admin-report-table-wrap"><table><thead><tr><th>رقم الحجز</th><th>اسم الحاجز</th><th>تاريخ الطلب</th><th>التذاكر</th><th>القيمة</th><th>الحالة</th></tr></thead><tbody>{eventBookings.map((b:Row)=><tr key={b.id}><td>{b.booking_number||b.id.slice(0,8)}</td><td>{b.customer_name||"—"}<small>{b.customer_phone||b.customer_email||""}</small></td><td>{b.created_at?new Date(b.created_at).toLocaleDateString("ar-SD-u-nu-latn"):"—"}</td><td>{(b.booking_items||[]).map((i:Row)=>`${i.ticket_types?.name||"تذكرة"} × ${i.quantity}`).join("، ")||"—"}</td><td>{money(b.subtotal,b.currency)}</td><td><span className={`admin-report-status status-${b.status}`}>{statusLabels[b.status]||b.status}</span></td></tr>)}</tbody></table></div>
                    <div className="admin-report-footer"><span>بيانات الحجز كما هي مسجلة في النظام</span><b>04</b></div>
                  </section>

                  <section className="admin-report-page admin-report-register">
                    <div className="admin-report-section-head"><span>04 / سجل الدخول</span><h2>التذاكر والتحقق عند البوابة</h2><p>حالة رموز الدخول ووقت استخدامها عند التحقق.</p></div>
                    <div className="admin-report-table-wrap"><table><thead><tr><th>كود التذكرة</th><th>اسم حامل التذكرة</th><th>الفئة</th><th>الحالة</th><th>وقت الدخول</th></tr></thead><tbody>{eventTickets.map((t:Row)=><tr key={t.id}><td dir="ltr">{t.ticket_code||"—"}</td><td>{t.attendee_name||"—"}</td><td>{eventTicketRows.find(x=>x.id===t.ticket_type_id)?.name||"—"}</td><td>{t.status==="used"?"تم الدخول":t.status==="valid"?"صالحة":"غير صالحة"}</td><td>{t.used_at?new Date(t.used_at).toLocaleString("ar-SD-u-nu-latn"):"—"}</td></tr>)}</tbody></table></div>
                    <div className="admin-report-note">هذا السجل يعرض بيانات التذاكر المتاحة في النظام وقت إصدار التقرير. أي دخول يتم بعد ذلك لن يظهر إلا في تقرير جديد.</div>
                    <div className="admin-report-footer"><span>حاضِر · نهاية التقرير</span><b>05</b></div>
                  </section>
                </div>
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
