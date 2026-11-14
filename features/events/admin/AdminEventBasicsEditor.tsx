"use client";

import type { Dispatch, SetStateAction } from "react";
import type { AdminEventFormValues } from "./admin-events.types";

type Props = {
  eventForm: AdminEventFormValues;
  setEventForm: Dispatch<SetStateAction<AdminEventFormValues>>;
  setCoverFile: Dispatch<SetStateAction<File | null>>;
  coverPreview: string;
  setCoverPreview: Dispatch<SetStateAction<string>>;
};

export default function AdminEventBasicsEditor({ eventForm, setEventForm, setCoverFile, coverPreview, setCoverPreview }: Props) {
  return (
    <section className="admin-event-form-section"><div className="admin-event-section-title"><span>01</span><div><h4>المعلومات الأساسية</h4><p>اسم الفعالية وتصنيفها ومكان إقامتها.</p></div></div><div className="admin-form-grid"><label>اسم الفعالية *<input required value={eventForm.title} onChange={e=>setEventForm({...eventForm,title:e.target.value})}/></label><label>فئة الفعالية<input value={eventForm.category} onChange={e=>setEventForm({...eventForm,category:e.target.value})} placeholder="مثال: موسيقى وحفلات، رياضة، مسرح"/><small className="admin-form-hint">تظهر الفئة ضمن بيانات الفعالية للزوار.</small></label><label>المدينة *<input required value={eventForm.city} onChange={e=>setEventForm({...eventForm,city:e.target.value})}/></label><label>المكان *<input required value={eventForm.venue} onChange={e=>setEventForm({...eventForm,venue:e.target.value})}/></label><label>العنوان التفصيلي<input value={eventForm.address} onChange={e=>setEventForm({...eventForm,address:e.target.value})}/></label><label>رابط الموقع / Google Maps<input type="url" placeholder="https://maps.google.com/..." value={eventForm.location_url} onChange={e=>setEventForm({...eventForm,location_url:e.target.value})}/></label><label className="admin-form-wide">صورة الغلاف (من جهازك)<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0]||null;setCoverFile(file);if(file){const url=URL.createObjectURL(file);setCoverPreview(url);}else{setCoverPreview(eventForm.cover_image_url);}}}/><small className="admin-form-hint">الصيغ المدعومة حسب المتصفح · الحد الأقصى 10 MB · تُرفع الصورة الأصلية دون ضغط.</small></label>{coverPreview&&<div className="admin-cover-preview"><img src={coverPreview} alt="معاينة صورة الغلاف"/><button type="button" onClick={()=>{setCoverFile(null);setCoverPreview("");setEventForm({...eventForm,cover_image_url:""});}}>إزالة الصورة</button></div>}<div className="admin-form-date-row"><label>الزمان / تاريخ ووقت البداية {!eventForm.is_continuous&&"*" }<input type="datetime-local" required={!eventForm.is_continuous} disabled={eventForm.is_continuous} value={eventForm.starts_at} onChange={e=>setEventForm({...eventForm,starts_at:e.target.value})}/></label><label className="admin-trending-check admin-continuous-check"><input type="checkbox" checked={eventForm.is_continuous} onChange={e=>setEventForm({...eventForm,is_continuous:e.target.checked,starts_at:e.target.checked?"":eventForm.starts_at,ends_at:e.target.checked?"":eventForm.ends_at})}/> <span>تذكرة مستمرة</span></label><label>تاريخ ووقت النهاية<input type="datetime-local" disabled={eventForm.is_continuous} value={eventForm.ends_at} onChange={e=>setEventForm({...eventForm,ends_at:e.target.value})}/></label></div><small className="admin-form-hint">فعّل «تذكرة مستمرة» للتذاكر غير المقيدة بتاريخ أو زمن محدد، مثل الحدائق والألعاب.</small></div></section>
  );
}
