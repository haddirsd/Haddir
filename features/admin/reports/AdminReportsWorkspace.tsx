"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { HaddirSelect } from "../../../components/ui/HaddirSelect";
import { useAdminReports } from "./useAdminReports";
import type { AdminReportRow } from "./admin-reports.types";

type Row = AdminReportRow;
const statusLabels: Record<string,string> = {draft:"مسودة",published:"منشورة",cancelled:"ملغاة",completed:"مكتملة",pending_payment:"بانتظار الدفع",under_review:"قيد المراجعة",confirmed:"مؤكد",rejected:"مرفوض",expired:"منتهي",submitted:"بانتظار المراجعة",approved:"مقبول",valid:"صالح",used:"مستخدم"};
const money = (value: unknown, currency = "SDG") => value == null ? "—" : `${Number(value).toLocaleString("ar-SD-u-nu-latn")} ${currency}`;

export default function AdminReportsWorkspace() {
  const [statsView,setStatsView] = useState<"general"|"event">("general");
  const [statsEventId,setStatsEventId] = useState("");
  const [bookingsPage,setBookingsPage] = useState(1);
  const [ticketsPage,setTicketsPage] = useState(1);
  const pageSize = 50;
  const { statistics, eventPage, loading, error, refresh } = useAdminReports(statsEventId,bookingsPage,ticketsPage);

  const renderReport = () => {
    const data=statistics;
          if(!data)return <p className="admin-no-data">جاري تجهيز الإحصائيات...</p>;
          const fmtCount=(v:number)=>v.toLocaleString("ar-SD-u-nu-latn");
          const sum=(items:Row[],field:string)=>items.reduce((n,x)=>n+Number(x[field]||0),0);
          const moneyLines=(items:Row[],field:string)=>{const grouped=new Map<string,number>();items.forEach(x=>{const c=String(x.currency||"SDG").trim();grouped.set(c,(grouped.get(c)||0)+Number(x[field]||0));});return grouped.size?Array.from(grouped.entries()).map(([c,v])=>money(v,c)).join(" · "):money(0,"SDG");};
          const bookingStats=data.bookings;
          const ticketStats=data.tickets;
          const eventMetrics=data.eventMetrics as Row[];
          const eventMetricById=new Map(eventMetrics.map((item:Row)=>[item.event_id,item]));
          const allTicketTypes=data.events.flatMap(e=>e.ticket_types||[]);
          const totalCapacity=sum(allTicketTypes,"quantity_total");
          const soldAttendees=Number(bookingStats.sold_quantity||0);
          const reservedAttendees=Number(bookingStats.reserved_quantity||0);
          const remainingCapacity=Math.max(0,totalCapacity-sum(allTicketTypes,"quantity_sold"));
          const rejectedQty=Number(bookingStats.rejected_quantity||0);
          const currentEvents=data.events.filter(e=>e.status==="published"&&(!e.ends_at||new Date(e.ends_at).getTime()>=Date.now()));
          const pastEvents=data.events.filter(e=>e.status==="completed"||(!!e.ends_at&&new Date(e.ends_at).getTime()<Date.now()));
          const roleCounts=(r:string)=>Number(data.profiles[r]||0)+(r==="gatekeeper"?Number(data.profiles.organizer||0):0);
          const revenueRows=bookingStats.revenue||[];
          const commissionRows=bookingStats.commission||[];
          const event=data.events.find(e=>e.id===statsEventId);
          const eventMetric=(event&&eventMetricById.get(event.id))||{};
          const eventBookings=eventPage.bookings;
          const eventTickets=eventPage.tickets;
          const eventTicketRows=(event?.ticket_types||[]).map((type:Row)=>{
            const metric=(eventMetric.ticket_type_metrics||[]).find((item:Row)=>item.ticket_type_id===type.id)||{};
            const sold=Number(metric.sold||0);
            const reserved=Number(metric.reserved||0);
            const inventoryUsed=Number(type.quantity_sold??(sold+reserved));
            return {...type,sold,reserved,rejectedCount:Number(metric.rejected||0),revenue:Number(metric.revenue||0),remaining:type.quantity_total==null?"غير محدود":Math.max(0,Number(type.quantity_total)-inventoryUsed)};
          });
          const eventRevenueRows=eventMetric.revenue||[];
          const eventCommissionRows=eventMetric.commission||[];
          const commissionByCurrency=new Map(eventCommissionRows.map((item:Row)=>[item.currency,Number(item.value||0)]));
          const eventNetRows=eventRevenueRows.map((item:Row)=>({currency:item.currency,value:Number(item.value||0)-Number(commissionByCurrency.get(item.currency)||0)}));
          const bookingPageCount=Math.max(1,Math.ceil(eventPage.bookingTotal/pageSize));
          const ticketPageCount=Math.max(1,Math.ceil(eventPage.ticketTotal/pageSize));
          const pager=(kind:"bookings"|"tickets",page:number,total:number,pages:number)=> <div className="admin-pagination" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,margin:"12px 0"}}><button type="button" className="admin-refresh" disabled={loading||page<=1} onClick={()=>kind==="bookings"?setBookingsPage(value=>Math.max(1,value-1)):setTicketsPage(value=>Math.max(1,value-1))}>السابق</button><span>صفحة {fmtCount(page)} من {fmtCount(pages)} · {fmtCount(total)} سجل</span><button type="button" className="admin-refresh" disabled={loading||page>=pages} onClick={()=>kind==="bookings"?setBookingsPage(value=>value+1):setTicketsPage(value=>value+1)}>التالي</button></div>;
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
              {metricCards([{title:"إجمالي المستخدمين",value:Object.values(data.profiles).reduce((n,v)=>n+Number(v||0),0)},{title:"العملاء",value:roleCounts("customer")},{title:"البوابون",value:roleCounts("gatekeeper")},{title:"الموظفون",value:roleCounts("supervisor")},{title:"المشرفون",value:roleCounts("admin")},{title:"المعلنون",value:roleCounts("advertiser")}])}
              <h3 className="admin-stats-heading">التذاكر والحجوزات</h3>
              {metricCards([{title:"إجمالي سعة التذاكر",value:totalCapacity},{title:"الأشخاص في التذاكر المؤكدة",value:soldAttendees},{title:"رموز الدخول المستخدمة",value:Number(ticketStats.used||0)},{title:"محجوزة قيد الدفع/المراجعة",value:reservedAttendees},{title:"التذاكر المتاحة فعلياً",value:remainingCapacity},{title:"ضمن حجوزات مرفوضة",value:rejectedQty},{title:"إجمالي الحجوزات",value:Number(bookingStats.total||0)},{title:"الحجوزات المؤكدة",value:Number(bookingStats.confirmed||0)},{title:"الحجوزات المرفوضة",value:Number(bookingStats.rejected||0)},{title:"بانتظار الدفع/المراجعة",value:Number(bookingStats.pending||0)}])}
              <h3 className="admin-stats-heading">المبيعات وأرباح المنصة</h3>
              {metricCards([{title:"إجمالي المبيعات المعتمدة",value:moneyLines(revenueRows,"value")},{title:"صافي دخل المنصة (العمولة)",value:moneyLines(commissionRows,"value"),hint:"حسب نسبة العمولة لكل فعالية، قبل المصروفات التشغيلية"}])}
              <h3 className="admin-stats-heading">ملخص كل فعالية</h3>
              <div className="admin-table-wrap"><table className="admin-data-table"><thead><tr><th>الفعالية</th><th>الحالة</th><th>الحجوزات</th><th>التذاكر المؤكدة</th><th>قيد الدفع/المراجعة</th><th>السعة</th><th>المتبقي فعلياً</th><th>المبيعات المعتمدة</th><th>دخل المنصة</th></tr></thead><tbody>{data.events.map(e=>{const m=eventMetricById.get(e.id)||{};const caps=e.ticket_types||[];return <tr key={e.id}><td>{e.title}</td><td>{statusLabels[e.status]||e.status}</td><td>{fmtCount(Number(m.booking_total||0))}</td><td>{fmtCount(Number(m.sold_quantity||0))}</td><td>{fmtCount(Number(m.reserved_quantity||0))}</td><td>{fmtCount(sum(caps,"quantity_total"))}</td><td>{fmtCount(Math.max(0,sum(caps,"quantity_total")-sum(caps,"quantity_sold")))}</td><td>{moneyLines(m.revenue||[],"value")}</td><td>{moneyLines(m.commission||[],"value")}</td></tr>;})}</tbody></table></div>
              <p className="admin-stats-note">المبيعات تشمل الحجوزات المؤكدة فقط. دخل المنصة هو قيمة العمولة المحسوبة من نسبة كل فعالية، قبل المصروفات التشغيلية. الطلبات المرفوضة والمعلقة لا تدخل في الإيرادات.</p>
            </>:<>
              <div className="admin-event-stat-select"><label htmlFor="stats-event-select">اختار الفعالية</label><HaddirSelect ariaLabel="اختيار الفعالية للإحصائيات" value={statsEventId} onChange={value=>{setStatsEventId(value);setBookingsPage(1);setTicketsPage(1);}} placeholder="اختر فعالية..." options={[{value:"",label:"اختر فعالية..."},...data.events.map(e=>({value:e.id,label:e.title+" — "+(statusLabels[e.status]||e.status)}))]}/></div>
              {!event?<p className="admin-no-data">اختار فعالية عشان تظهر إحصائياتها.</p>:<>
                <div className="admin-selected-event"><div><small>الفعالية المحددة</small><h3>{event.title}</h3><span>{statusLabels[event.status]||event.status} · عمولة المنصة {Number(event.platform_fee_percent||0)}%</span></div><button className="admin-print-button" type="button" onClick={()=>window.print()}>تحميل تقرير الفعالية PDF</button></div>
                <div className="admin-event-report" dir="rtl">
                  <section className="admin-report-page admin-report-cover">
                    <div className="admin-report-topline"><img src="/ticket.svg" alt="ختم حاضر" /><span>حاضر · منصة الفعاليات</span><small>تقرير فعالية تفصيلي</small></div>
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
                      <article><small>عدد الحاجزين</small><strong>{fmtCount(Number(eventMetric.people_count||0))}</strong><span>حجوزات غير مرفوضة أو ملغاة أو منتهية</span></article>
                      <article><small>الحجوزات المؤكدة</small><strong>{fmtCount(Number(eventMetric.confirmed_count||0))}</strong><span>حجوزات تم اعتمادها</span></article>
                      <article><small>قيد الدفع / المراجعة</small><strong>{fmtCount(Number(eventMetric.pending_count||0))}</strong><span>طلبات لم تكتمل مراجعتها</span></article>
                      <article><small>الحجوزات المرفوضة</small><strong>{fmtCount(Number(eventMetric.rejected_count||0))}</strong><span>طلبات لم يتم اعتمادها</span></article>
                      <article><small>التذاكر المصدرة</small><strong>{fmtCount(Number(eventMetric.ticket_total||0))}</strong><span>إجمالي رموز الدخول</span></article>
                      <article><small>تم تسجيل الدخول</small><strong>{fmtCount(Number(eventMetric.ticket_used||0))}</strong><span>{Number(eventMetric.ticket_total||0)?Math.round(Number(eventMetric.ticket_used||0)/Number(eventMetric.ticket_total||0)*100):0}% من التذاكر المصدرة</span></article>
                    </div>
                    <div className="admin-report-highlight">
                      <div><small>إجمالي المبيعات المعتمدة</small><strong>{moneyLines(eventRevenueRows,"value")}</strong></div>
                      <div><small>عمولة منصة حاضر</small><strong>{moneyLines(eventCommissionRows,"value")}</strong></div>
                      <div><small>صافي مستحق منظم الفعالية</small><strong>{moneyLines(eventNetRows,"value")}</strong></div>
                    </div>
                    <h3 className="admin-report-subtitle">حالة التذاكر والدخول</h3>
                    <div className="admin-report-status-list">
                      <div><span>صالحة ولم تستخدم</span><b>{fmtCount(Math.max(0,Number(eventMetric.ticket_total||0)-Number(eventMetric.ticket_used||0)-Number(eventMetric.ticket_invalid||0)))}</b></div>
                      <div><span>تم استخدامها عند البوابة</span><b>{fmtCount(Number(eventMetric.ticket_used||0))}</b></div>
                      <div><span>غير صالحة / ملغاة</span><b>{fmtCount(Number(eventMetric.ticket_invalid||0))}</b></div>
                      <div><span>إجمالي الكمية المحجوزة قيد المراجعة</span><b>{fmtCount(sum(eventTicketRows,"reserved"))}</b></div>
                    </div>
                    <p className="admin-report-note">تُحتسب المبيعات من الحجوزات المؤكدة فقط. صافي المنظم هو المبيعات المعتمدة بعد خصم عمولة المنصة، ولا يشمل المصروفات التشغيلية أو التسويات الخارجية.</p>
                    <div className="admin-report-footer"><span>حاضر · تقرير الفعالية</span><b>02</b></div>
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
                    <div className="admin-report-footer"><span>حاضر · تقرير الفعالية</span><b>03</b></div>
                  </section>

                  <section className="admin-report-page admin-report-register">
                    <div className="admin-report-section-head"><span>03 / سجل الحجوزات</span><h2>تفاصيل طلبات الحجز</h2><p>السجلات المعروضة مقسمة إلى صفحات من 50 حجزاً.</p></div>
                    <div className="admin-report-table-wrap"><table><thead><tr><th>رقم الحجز</th><th>تاريخ الطلب</th><th>التذاكر</th><th>القيمة</th><th>الحالة</th></tr></thead><tbody>{eventBookings.map((b:Row)=><tr key={b.id}><td>{b.booking_number||b.id.slice(0,8)}</td><td>{b.created_at?new Date(b.created_at).toLocaleDateString("ar-SD-u-nu-latn"):"—"}</td><td>{(b.booking_items||[]).map((i:Row)=>`${i.ticket_types?.name||"تذكرة"} × ${i.quantity}`).join("، ")||"—"}</td><td>{money(b.subtotal,b.currency)}</td><td><span className={`admin-report-status status-${b.status}`}>{statusLabels[b.status]||b.status}</span></td></tr>)}</tbody></table></div>
                    {pager("bookings",bookingsPage,eventPage.bookingTotal,bookingPageCount)}
                    <div className="admin-report-footer"><span>بيانات الحجوزات · الصفحة الحالية من السجل</span><b>04</b></div>
                  </section>

                  <section className="admin-report-page admin-report-register">
                    <div className="admin-report-section-head"><span>04 / سجل الدخول</span><h2>التذاكر والتحقق عند البوابة</h2><p>السجلات المعروضة مقسمة إلى صفحات من 50 تذكرة.</p></div>
                    <div className="admin-report-table-wrap"><table><thead><tr><th>كود التذكرة</th><th>اسم حامل التذكرة</th><th>الفئة</th><th>الحالة</th><th>وقت الدخول</th></tr></thead><tbody>{eventTickets.map((t:Row)=><tr key={t.id}><td dir="ltr">{t.ticket_code||"—"}</td><td>{t.attendee_name||"—"}</td><td>{eventTicketRows.find((x: Row)=>x.id===t.ticket_type_id)?.name||"—"}</td><td>{t.status==="used"?"تم الدخول":t.status==="valid"?"صالحة":"غير صالحة"}</td><td>{t.used_at?new Date(t.used_at).toLocaleString("ar-SD-u-nu-latn"):"—"}</td></tr>)}</tbody></table></div>
                    {pager("tickets",ticketsPage,eventPage.ticketTotal,ticketPageCount)}
                    <div className="admin-report-note">هذا السجل يعرض بيانات التذاكر · الصفحة الحالية من السجل في النظام وقت إصدار التقرير. أي دخول يتم بعد ذلك لن يظهر إلا في تقرير جديد.</div>
                    <div className="admin-report-footer"><span>حاضر · نهاية التقرير</span><b>05</b></div>
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
