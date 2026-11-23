"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Ticket } from "lucide-react";
import { useAdminBookings } from "./useAdminBookings";
import type { AdminBookingRow } from "./admin-bookings.types";
import { SkeletonState } from "../../../components/ui/SkeletonState";

const statusLabels: Record<string, string> = {
  pending_payment: "بانتظار الدفع", under_review: "قيد المراجعة", confirmed: "مؤكد",
  rejected: "مرفوض", expired: "منتهي", submitted: "بانتظار المراجعة",
  approved: "مقبول",
};
const fmt = (value: unknown) => value == null || value === "" ? "—" : String(value);
const money = (value: unknown, currency = "SDG") => value == null ? "—" : `${Number(value).toLocaleString("ar-SD-u-nu-latn")} ${currency}`;
const PAGE_SIZE = 100;

export default function AdminBookingsWorkspace() {
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const { rows, totalCount, loading, error, refresh } = useAdminBookings(searchTerm, page);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  useEffect(() => { if (totalPages > 0 && page >= totalPages) setPage(totalPages - 1); }, [page, totalPages]);

  return <section className="admin-panel">
    <div className="admin-panel-head">
      <div><h3>الحجوزات</h3><p>متابعة الحجوزات وحالاتها وإثباتات الدفع المرتبطة بها</p></div>
      <div className="admin-panel-actions">
        <label className="admin-search-box"><span>بحث برقم الحجز أو بريد العميل</span><input type="search" value={searchTerm} onChange={event => { setSearchTerm(event.target.value); setPage(0); }} placeholder="رقم الحجز أو بريد العميل"/></label>
        <button className="admin-refresh" type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16}/> تحديث</button>
      </div>
    </div>
    {error&&<p className="admin-form-message" role="alert">{error}</p>}
    {loading?<SkeletonState variant="admin-cards" count={4} label="جاري تحميل الحجوزات..." />:<div className="admin-booking-cards">
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
    {!loading && totalCount > 0 && <div className="admin-pagination" aria-label="صفحات الحجوزات">
      <span>عرض {Math.min(page * PAGE_SIZE + 1, totalCount).toLocaleString("ar-SD-u-nu-latn")}–{Math.min((page + 1) * PAGE_SIZE, totalCount).toLocaleString("ar-SD-u-nu-latn")} من {totalCount.toLocaleString("ar-SD-u-nu-latn")} حجز</span>
      <div className="admin-pagination-controls">
        <button type="button" onClick={() => setPage(current => Math.max(0, current - 1))} disabled={page === 0}>السابق</button>
        <span>صفحة {(page + 1).toLocaleString("ar-SD-u-nu-latn")} من {totalPages.toLocaleString("ar-SD-u-nu-latn")}</span>
        <button type="button" onClick={() => setPage(current => Math.min(totalPages - 1, current + 1))} disabled={page + 1 >= totalPages}>التالي</button>
      </div>
    </div>}
  </section>;
}
