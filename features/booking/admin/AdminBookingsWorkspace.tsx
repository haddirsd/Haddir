"use client";

import { useState } from "react";
import { RefreshCw, Ticket } from "lucide-react";
import { useAdminBookings } from "./useAdminBookings";
import type { AdminBookingRow } from "./admin-bookings.types";

const statusLabels: Record<string, string> = {
  pending_payment: "بانتظار الدفع", under_review: "قيد المراجعة", confirmed: "مؤكد",
  rejected: "مرفوض", expired: "منتهي", submitted: "بانتظار المراجعة",
  approved: "مقبول",
};
const fmt = (value: unknown) => value == null || value === "" ? "—" : String(value);
const money = (value: unknown, currency = "SDG") => value == null ? "—" : `${Number(value).toLocaleString("ar-SD-u-nu-latn")} ${currency}`;

export default function AdminBookingsWorkspace() {
  const [searchTerm, setSearchTerm] = useState("");
  const { rows, loading, error, refresh } = useAdminBookings(searchTerm);

  return <section className="admin-panel">
    <div className="admin-panel-head">
      <div><h3>الحجوزات</h3><p>متابعة الحجوزات وحالاتها وإثباتات الدفع المرتبطة بها</p></div>
      <div className="admin-panel-actions">
        <label className="admin-search-box"><span>بحث برقم الحجز أو بريد العميل</span><input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="رقم الحجز أو بريد العميل"/></label>
        <button className="admin-refresh" type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16}/> تحديث</button>
      </div>
    </div>
    {error&&<p className="admin-form-message" role="alert">{error}</p>}
    {loading?<div className="admin-no-data motion-loading" role="status"><span className="haddir-loading-indicator" aria-hidden="true"/><span>جاري تحميل الحجوزات...</span></div>:<div className="admin-booking-cards">
      {rows.length===0?<p className="admin-no-data">لا توجد حجوزات حتى الآن.</p>:rows.map((r:AdminBookingRow,i:number)=>{
        const items=(r.booking_items||[]).map(item=>`${item.ticket_types?.name||"تذكرة"} × ${item.quantity}`).join("، ")||"—";
        const payment=[...(r.payment_submissions||[])].sort((a,b)=>new Date(b.created_at||0).getTime()-new Date(a.created_at||0).getTime())[0];
        return <article className="admin-booking-card" key={r.id||i}>
          <div className="admin-booking-card-head">
            <div><small>رقم الحجز</small><h4>{r.booking_number||"—"}</h4></div>
            <span className={"admin-event-status status-"+(r.status||"pending_payment")}>{statusLabels[r.status]||fmt(r.status)}</span>
          </div>
          <div className="admin-booking-card-event"><Ticket size={17}/><strong>{r.events?.title||"فعالية غير محددة"}</strong></div>
          <div className="admin-booking-card-grid">
            <div><small>العميل</small><strong>{fmt(r.customer_name)}</strong></div>
            <div><small>البريد الإلكتروني</small><strong>{fmt(r.customer_email)}</strong></div>
            <div><small>رقم الهاتف</small><strong dir="ltr">{fmt(r.customer_phone)}</strong></div>
            <div><small>التذاكر</small><strong>{items}</strong></div>
            <div><small>إجمالي المبلغ</small><strong>{money(r.subtotal,r.currency)}</strong></div>
            <div><small>وسيلة الدفع</small><strong>{payment?.payment_account_name||"لم يُرسل إثبات دفع بعد"}</strong></div>
            <div><small>رقم الحساب</small><strong dir="ltr">{fmt(payment?.payment_account_number)}</strong></div>
            <div><small>اسم المستفيد</small><strong>{fmt(payment?.payment_account_beneficiary)}</strong></div>
            <div><small>إيصال التحويل</small>{payment?.receipt_url?<a className="admin-payment-receipt" href={payment.receipt_url} target="_blank" rel="noreferrer">عرض إيصال التحويل</a>:<strong>لا يوجد إيصال</strong>}</div>
            <div><small>حالة إثبات الدفع</small><strong>{payment?.status?statusLabels[payment.status]||payment.status:"لم يُرسل"}</strong></div>
            <div><small>مرجع التحويل</small><strong>{payment?.transfer_reference||"—"}</strong></div>
            <div><small>تاريخ الحجز</small><strong>{r.created_at?new Date(r.created_at).toLocaleString("ar-SD-u-nu-latn"):"—"}</strong></div>
            {r.expires_at&&r.status!=="confirmed"&&<div><small>انتهاء الحجز</small><strong>{new Date(r.expires_at).toLocaleString("ar-SD-u-nu-latn")}</strong></div>}
          </div>
        </article>;
      })}
    </div>}
  </section>;
}
