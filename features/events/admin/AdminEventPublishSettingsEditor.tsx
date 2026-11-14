"use client";

import type { Dispatch, SetStateAction } from "react";
import type { AdminEventFormValues } from "./admin-events.types";

type Props = {
  eventForm: AdminEventFormValues;
  setEventForm: Dispatch<SetStateAction<AdminEventFormValues>>;
};

export default function AdminEventPublishSettingsEditor({ eventForm, setEventForm }: Props) {
  return (
    <section className="admin-event-form-section"><div className="admin-event-section-title"><span>02</span><div><h4>الوصف وإعدادات النشر</h4><p>العمولة، وصف الفعالية، وظهورها في الصفحة الرئيسية.</p></div></div><div className="admin-form-grid"><label>نسبة عمولة المنصة (%) *<input type="number" min="0" max="100" step="0.01" required value={eventForm.platform_fee_percent} onChange={e=>setEventForm({...eventForm,platform_fee_percent:e.target.value})}/><small className="admin-form-hint">تُستخدم لحساب صافي عمولة حاضر في الإحصائيات.</small></label><label className="admin-form-wide">عن الفعالية<textarea rows={3} value={eventForm.description} onChange={e=>setEventForm({...eventForm,description:e.target.value})}/></label><label className="admin-trending-check"><input type="checkbox" checked={eventForm.is_trending} onChange={e=>setEventForm({...eventForm,is_trending:e.target.checked})}/> إظهار الفعالية في «رائج الآن»</label></div></section>
  );
}
