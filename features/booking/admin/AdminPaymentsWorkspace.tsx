"use client";

import { useEffect, useState } from "react";
import { Ticket, RefreshCw } from "lucide-react";
import { HaddirDialog } from "../../../components/ui/HaddirDialog";
import { listAdminPaymentEvents, reviewAdminPayment } from "./admin-payments.service";
import type { AdminPaymentEventFilter } from "./admin-payments.service";
import { useAdminPayments } from "./useAdminPayments";
import type { AdminPaymentDecision, AdminPaymentRow } from "./admin-payments.types";

const statusLabels: Record<string,string> = { submitted:"بانتظار المراجعة", approved:"مقبول", rejected:"مرفوض" };
const fmt = (value: unknown) => value == null || value === "" ? "—" : String(value);
const money = (value: unknown, currency = "SDG") => value == null ? "—" : `${Number(value).toLocaleString("ar-SD-u-nu-latn")} ${currency}`;
const PAGE_SIZE = 100;

export default function AdminPaymentsWorkspace() {
  const [page, setPage] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [eventFilters, setEventFilters] = useState<AdminPaymentEventFilter[]>([]);
  const [eventFilterError, setEventFilterError] = useState("");
  const { rows, totalCount, loading, error, refresh } = useAdminPayments(page, selectedEventId || null);
  useEffect(() => {
    let active = true;
    void listAdminPaymentEvents().then(result => {
      if (!active) return;
      setEventFilters(result.events);
      setEventFilterError(result.error || "");
    });
    return () => { active = false; };
  }, []);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  useEffect(() => { if (totalPages > 0 && page >= totalPages) setPage(totalPages - 1); }, [page, totalPages]);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string,string>>({});
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [approvalTarget,setApprovalTarget]=useState<AdminPaymentRow|null>(null);
  const [rejectionTarget,setRejectionTarget]=useState<AdminPaymentRow|null>(null);

  const reviewPayment = async (row: AdminPaymentRow, decision: AdminPaymentDecision) => {
    const reason = decision === "reject" ? (rejectionReasons[row.id] || "").trim() : null;
    if (decision === "reject" && !reason) { setActionError("اكتب سبب الرفض أولاً حتى نرسله للعميل."); return; }
    setReviewing(true); setActionError(""); setActionMessage("");
    try {
      const result = await reviewAdminPayment(row.id, decision, reason);
      if (result.error) { setActionError("تعذرت مراجعة إثبات الدفع: " + result.error); return; }
      setRejectionReasons(current => { const next = { ...current }; delete next[row.id]; return next; });
      setActionMessage(decision === "approve"
        ? "تم اعتماد الدفع وإصدار " + Number(result.data?.ticketsCreated || 0) + " تذكرة. وصل إشعار القبول للعميل داخل التطبيق."
        : "تم رفض إثبات الدفع وإرسال السبب للعميل داخل التطبيق.");
      await refresh();
      const eventResult = await listAdminPaymentEvents();
      if (!eventResult.error) setEventFilters(eventResult.events);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "تعذرت مراجعة إثبات الدفع.");
    } finally {
      setReviewing(false);
    }
  };

  return <section className="admin-panel">
    <div className="admin-panel-head">
      <div><h3>مراجعة المدفوعات</h3><p>مراجعة إثباتات التحويل المرتبطة بالحجز والعميل والفعالية</p></div>
      <button className="admin-refresh" type="button" onClick={async () => { await refresh(); const result = await listAdminPaymentEvents(); if (!result.error) setEventFilters(result.events); }} disabled={loading}><RefreshCw size={16}/> تحديث</button>
    </div>
    <div className="admin-payment-event-filter">
      <label htmlFor="admin-payment-event-select">تصفية حسب الفعالية</label>
      <select id="admin-payment-event-select" value={selectedEventId} onChange={event => { setSelectedEventId(event.target.value); setPage(0); }}>
        <option value="">كل الفعاليات ({eventFilters.reduce((sum, item) => sum + item.pendingCount, 0).toLocaleString("ar-SD-u-nu-latn")} معلّق)</option>
        {eventFilters.map(item => <option key={item.id} value={item.id}>{item.pendingCount > 0 ? "🔴 " : ""}{item.title}{item.pendingCount > 0 ? ` (${item.pendingCount})` : ""}</option>)}
      </select>
      {eventFilterError && <small role="alert">{eventFilterError}</small>}
    </div>
    {error&&<div className="admin-notice" role="alert">{error}</div>}
    {actionError&&<div className="admin-notice" role="alert">{actionError}</div>}
    {actionMessage&&<div className="admin-notice" role="status">{actionMessage}</div>}
    {loading?<p className="admin-no-data">جاري تحميل إثباتات الدفع...</p>:<div className="admin-payment-cards">
      {rows.length===0?<p className="admin-no-data">لا توجد إثباتات دفع حتى الآن.</p>:rows.map((r:AdminPaymentRow,i:number)=>{
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
            <div><small>التذاكر</small><strong>{(r.bookings?.booking_items||[]).map(item=>`${item.ticket_types?.name||"تذكرة"} × ${item.quantity}`).join("، ")||"—"}</strong></div>
            <div><small>مرجع التحويل</small><strong>{fmt(r.transfer_reference)}</strong></div>
            <div><small>تاريخ الإرسال</small><strong>{r.created_at?new Date(r.created_at).toLocaleString("ar-SD-u-nu-latn"):"—"}</strong></div>
            <div><small>الإيصال</small>{r.receipt_url?<a className="admin-payment-receipt" href={r.receipt_url} target="_blank" rel="noreferrer">عرض إيصال التحويل</a>:<strong>غير مرفق</strong>}</div>
            {r.review_note&&<div className="admin-payment-note"><small>ملاحظة المراجعة</small><strong>{r.review_note}</strong></div>}
          </div>
          {pending&&<div className="admin-payment-actions">
            <button className="admin-payment-approve" type="button" disabled={reviewing||!r.receipt_url} onClick={()=>setApprovalTarget(r)}>قبول الدفع وإصدار التذاكر</button>
            <div className="admin-payment-reject-box">
              <label>سبب الرفض (سيصل للعميل)<textarea rows={2} value={rejectionReasons[r.id]||""} onChange={event=>setRejectionReasons(current=>({...current,[r.id]:event.target.value}))} placeholder="مثلاً: صورة الإيصال غير واضحة أو المبلغ غير مطابق..."/></label>
              <button className="admin-payment-reject" type="button" disabled={reviewing||!(rejectionReasons[r.id]||"").trim()} onClick={()=>setRejectionTarget(r)}>رفض وإرسال السبب</button>
            </div>
          </div>}
        </article>;
      })}
    </div>}
    {!loading && totalCount > 0 && <div className="admin-pagination" aria-label="صفحات المدفوعات">
      <span>عرض {Math.min(page * PAGE_SIZE + 1, totalCount).toLocaleString("ar-SD-u-nu-latn")}–{Math.min((page + 1) * PAGE_SIZE, totalCount).toLocaleString("ar-SD-u-nu-latn")} من {totalCount.toLocaleString("ar-SD-u-nu-latn")} إثبات دفع</span>
      <div className="admin-pagination-controls">
        <button type="button" onClick={() => setPage(current => Math.max(0, current - 1))} disabled={page === 0}>السابق</button>
        <span>صفحة {(page + 1).toLocaleString("ar-SD-u-nu-latn")} من {totalPages.toLocaleString("ar-SD-u-nu-latn")}</span>
        <button type="button" onClick={() => setPage(current => Math.min(totalPages - 1, current + 1))} disabled={page + 1 >= totalPages}>التالي</button>
      </div>
    </div>}
    {rejectionTarget&&<HaddirDialog open title="تأكيد رفض إثبات الدفع؟" description={"سيتم رفض الإيصال وإرسال سبب الرفض للعميل: "+(rejectionReasons[rejectionTarget.id]||"")} confirmLabel="تأكيد الرفض" tone="danger" busy={reviewing} onCancel={()=>setRejectionTarget(null)} onConfirm={async()=>{const row=rejectionTarget;setRejectionTarget(null);await reviewPayment(row,"reject");}}/>}
    {approvalTarget&&<HaddirDialog open title="اعتماد الدفع وإصدار التذاكر؟" description="سيتم اعتماد إثبات التحويل وإصدار تذاكر برموز دخول من 10 أرقام وإرسال إشعار للعميل." confirmLabel="اعتماد الدفع" tone="success" busy={reviewing} onCancel={()=>setApprovalTarget(null)} onConfirm={async()=>{const row=approvalTarget;setApprovalTarget(null);await reviewPayment(row,"approve");}}/>}
  </section>;
}
