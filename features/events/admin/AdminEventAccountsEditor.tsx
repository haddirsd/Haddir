"use client";

import type { Dispatch, SetStateAction } from "react";
import type { AdminEventAccountForm } from "./admin-events.types";

type Props = {
  forms: AdminEventAccountForm[];
  setForms: Dispatch<SetStateAction<AdminEventAccountForm[]>>;
};

export default function AdminEventAccountsEditor({ forms, setForms }: Props) {
  return (
    <section className="admin-event-form-section admin-event-form-section-nested">
      <div className="admin-event-section-title"><span>03</span><div><h4>حسابات التحويل</h4><p>وسائل الدفع وأرقام الحسابات الخاصة بهذه الفعالية.</p></div></div>
      <section className="admin-ticket-editor">
        <div className="admin-ticket-heading">
          <h3>حسابات التحويل الخاصة بالفعالية</h3>
          <button type="button" className="admin-create-button" onClick={() => setForms(v => [...v, { account_name: "", account_number: "", beneficiary: "", is_active: true, sort_order: (v.length + 1) * 10 }])}>＋ إضافة حساب</button>
        </div>
        {forms.map((account, index) => (
          <div className="admin-ticket-row" key={account.id || "event-account-" + index}>
            <div className="admin-form-grid">
              <label>اسم البنك أو طريقة الدفع *<input value={account.account_name} onChange={e => setForms(v => v.map((item, i) => i === index ? { ...item, account_name: e.target.value } : item))} /></label>
              <label>رقم الحساب *<input dir="ltr" value={account.account_number} onChange={e => setForms(v => v.map((item, i) => i === index ? { ...item, account_number: e.target.value } : item))} /></label>
              <label>اسم المستفيد *<input value={account.beneficiary} onChange={e => setForms(v => v.map((item, i) => i === index ? { ...item, beneficiary: e.target.value } : item))} /></label>
              <label className="admin-trending-check"><input type="checkbox" checked={account.is_active} onChange={e => setForms(v => v.map((item, i) => i === index ? { ...item, is_active: e.target.checked } : item))} /> متاح للحجز</label>
              <button type="button" className="admin-delete-button" onClick={() => setForms(v => v.filter((_, i) => i !== index))}>إزالة الحساب</button>
            </div>
          </div>
        ))}
      </section>
    </section>
  );
}
