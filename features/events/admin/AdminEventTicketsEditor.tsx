"use client";

import type { Dispatch, SetStateAction } from "react";
import { HaddirSelect } from "../../../components/ui/HaddirSelect";
import type { AdminTicketForm } from "./admin-events.types";

type Props = {
  forms: AdminTicketForm[];
  setForms: Dispatch<SetStateAction<AdminTicketForm[]>>;
  emptyTicket: () => AdminTicketForm;
};

export default function AdminEventTicketsEditor({ forms, setForms, emptyTicket }: Props) {
  return (
    <section className="admin-event-form-section admin-event-form-section-nested">
      <div className="admin-event-section-title"><span>04</span><div><h4>فئات التذاكر</h4><p>حدد أسعار الفئات والكميات وفترة البيع.</p></div></div>
      <div className="admin-ticket-editor">
        <div className="admin-ticket-heading"><h3>أنواع التذاكر</h3><button type="button" className="admin-create-button" onClick={() => setForms(v => [...v, emptyTicket()])}>＋ إضافة فئة تذكرة</button></div>
        {forms.map((ticket, index) => (
          <div className="admin-ticket-row" key={ticket.id || "new-" + index}>
            <div className="admin-ticket-row-head"><b>الفئة {index + 1}</b>{forms.length > 1 && <button type="button" className="admin-delete-button" onClick={() => setForms(v => v.filter((_, i) => i !== index))}>إزالة</button>}</div>
            <div className="admin-form-grid">
              <label>اسم التذكرة *<input required value={ticket.name} onChange={e => setForms(v => v.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} /></label>
              <label>الوصف (اختياري)<input value={ticket.description} onChange={e => setForms(v => v.map((item, i) => i === index ? { ...item, description: e.target.value } : item))} /></label>
              <label>السعر *<input type="number" min="0" step="0.01" required value={ticket.price} onChange={e => setForms(v => v.map((item, i) => i === index ? { ...item, price: e.target.value } : item))} /></label>
              <label>العملة<HaddirSelect value={ticket.currency} onChange={value => setForms(v => v.map((item, i) => i === index ? { ...item, currency: value } : item))} options={[{ value: "SDG", label: "جنيه سوداني (SDG)" }, { value: "SAR", label: "ريال سعودي (SAR)" }, { value: "AED", label: "درهم إماراتي (AED)" }, { value: "USD", label: "دولار أمريكي (USD)" }, { value: "EGP", label: "جنيه مصري (EGP)" }]} /></label>
              <label>الكمية المتاحة (اختياري)<input type="number" min={ticket.quantity_sold || 1} step="1" value={ticket.quantity_total} placeholder="فارغ = غير محدود" onChange={e => setForms(v => v.map((item, i) => i === index ? { ...item, quantity_total: e.target.value } : item))} /><small className="admin-form-hint">اتركها فارغة إذا كانت التذاكر غير محدودة الكمية.</small></label>
              <label>بداية البيع<input type="datetime-local" value={ticket.sales_start_at} onChange={e => setForms(v => v.map((item, i) => i === index ? { ...item, sales_start_at: e.target.value } : item))} /></label>
              <label>نهاية البيع<input type="datetime-local" value={ticket.sales_end_at} onChange={e => setForms(v => v.map((item, i) => i === index ? { ...item, sales_end_at: e.target.value } : item))} /></label>
              <label className="admin-trending-check"><input type="checkbox" checked={ticket.is_active} onChange={e => setForms(v => v.map((item, i) => i === index ? { ...item, is_active: e.target.checked } : item))} /> الفئة مفعّلة للحجز</label>
              {ticket.quantity_sold > 0 && <small className="admin-form-hint">تم بيع {ticket.quantity_sold} — لا يمكن تقليل الكمية عنها.</small>}
            </div>
          </div>
        ))}
      </div>
      <p className="admin-form-hint">سيتم حفظ الفعالية كمسودة، ولن تظهر للجمهور إلا بعد نشرها.</p>
    </section>
  );
}
