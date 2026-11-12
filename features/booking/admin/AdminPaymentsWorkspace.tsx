"use client";

import { useState } from "react";
import { Ticket, RefreshCw } from "lucide-react";
import { HaddirDialog } from "../../../components/ui/HaddirDialog";
import { reviewAdminPayment } from "./admin-payments.service";
import { useAdminPayments } from "./useAdminPayments";
import type { AdminPaymentDecision, AdminPaymentRow } from "./admin-payments.types";

const statusLabels: Record<string,string> = { submitted:"بانتظار المراجعة", approved:"مقبول", rejected:"مرفوض" };
const fmt = (value: unknown) => value == null || value === "" ? "—" : String(value);
const money = (value: unknown, currency = "SDG") => value == null ? "—" : `${Number(value).toLocaleString("ar-SD-u-nu-latn")} ${currency}`;

export default function AdminPaymentsWorkspace() {
  const { rows, loading, error, refresh } = useAdminPayments();
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
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "تعذرت مراجعة إثبات الدفع.");
    } finally {
      setReviewing(false);
    }
  };

  return <section className="admin-panel">
    <div className="admin-panel-head">
      <div><h3>مراجعة المدفوعات</h3><p>مراجعة إثباتات التحويل المرتبطة بالحجز والعميل والفعالية</p></div>
      <button className="admin-refresh" type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16}/> تحديث</button>
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
    {rejectionTarget&&<HaddirDialog open title="تأكيد رفض إثبات الدفع؟" description={"سيتم رفض الإيصال وإرسال سبب الرفض للعميل: "+(rejectionReasons[rejectionTarget.id]||"")} confirmLabel="تأكيد الرفض" tone="danger" busy={reviewing} onCancel={()=>setRejectionTarget(null)} onConfirm={async()=>{const row=rejectionTarget;setRejectionTarget(null);await reviewPayment(row,"reject");}}/>}
    {approvalTarget&&<HaddirDialog open title="اعتماد الدفع وإصدار التذاكر؟" description="سيتم اعتماد إثبات التحويل وإصدار تذاكر برموز دخول من 10 أرقام وإرسال إشعار للعميل." confirmLabel="اعتماد الدفع" tone="success" busy={reviewing} onCancel={()=>setApprovalTarget(null)} onConfirm={async()=>{const row=approvalTarget;setApprovalTarget(null);await reviewPayment(row,"approve");}}/>}
  </section>;
}
