"use client";

import { RefreshCw } from "lucide-react";
import { useAdminActivity } from "./useAdminActivity";
import type { AdminActivityRow } from "./admin-activity.types";

const actionNames:Record<string,string>={"events.created":"أضاف فعالية","events.updated":"عدّل بيانات فعالية","events.deleted":"حذف فعالية","event.cancelled":"ألغى فعالية / أخفاها","event.published":"نشر فعالية","profiles.created":"أضاف عميلاً / مستخدماً","user.role_changed":"غيّر دور مستخدم","bookings.created":"أنشأ حجزاً","booking.confirmed":"وافق على الحجز","booking.rejected":"رفض الحجز","payment.approved":"اعتمد إثبات الدفع","payment.rejected":"رفض إثبات الدفع","ticket.checked_in":"أكد دخول التذكرة","tickets.deleted":"حذف تذكرة","ticket.checkin_reversed":"ألغى تأكيد دخول التذكرة","ticket.status_changed":"عدّل حالة التذكرة","ticket_types.created":"أضاف فئة تذاكر","ticket_types.updated":"عدّل فئة تذاكر","ticket_types.deleted":"حذف فئة تذاكر","event_payment_accounts.created":"أضاف حساب دفع","event_payment_accounts.updated":"عدّل حساب دفع","event_payment_accounts.deleted":"حذف حساب دفع"};
const roleNames:Record<string,string>={owner:"مالك المنصة",admin:"مشرف",supervisor:"موظف حاضر",gatekeeper:"بواب",organizer:"بواب",advertiser:"معلن",customer:"عميل",unknown:"غير معروف"};
const fieldNames:Record<string,string>={title:"اسم الفعالية",status:"الحالة",description:"الوصف",venue:"المكان",city:"المدينة",starts_at:"موعد البداية",ends_at:"موعد النهاية",platform_fee_percent:"نسبة العمولة",role:"الدور",full_name:"الاسم",is_trending:"رائج الآن",price:"السعر",quantity_total:"الكمية",name:"الاسم",is_active:"التفعيل"};

export default function AdminActivityWorkspace() {
  const { rows, loading, error, refresh } = useAdminActivity();
  const detailText = (details: Record<string, unknown> | null) => Object.entries(details || {}).map(([key,value]) => {
    const v = value && typeof value === "object" && ("before" in value || "after" in value)
      ? `من ${JSON.stringify((value as any).before)} إلى ${JSON.stringify((value as any).after)}`
      : JSON.stringify(value);
    return `${fieldNames[key]||key}: ${v}`;
  }).join(" · ");

  return <section className="admin-panel">
    <div className="admin-panel-head"><div><h3>سجل الإجراءات</h3><p>آخر الإجراءات المسجلة على المنصة</p></div><button className="admin-refresh" type="button" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={16}/> تحديث</button></div>
    {error&&<div className="admin-notice" role="alert">{error}</div>}
    {loading?<p className="admin-no-data">جاري تحميل سجل الإجراءات...</p>:<div className="admin-table-wrap"><table className="admin-data-table"><thead><tr><th>المنفّذ</th><th>دوره</th><th>الإجراء</th><th>العنصر</th><th>التفاصيل</th><th>التاريخ والوقت</th></tr></thead><tbody>{rows.map((row:AdminActivityRow,index:number)=><tr key={row.id||index}><td><strong>{row.actor_name||"مستخدم غير معروف"}</strong></td><td>{roleNames[row.actor_role||"unknown"]||row.actor_role}</td><td>{actionNames[row.action]||row.action}</td><td>{row.entity_label||row.entity_type||"—"}{row.events?.title&&<small className="admin-stat-hint"> · {row.events.title}</small>}</td><td>{detailText(row.details)||"—"}</td><td>{row.created_at?new Date(row.created_at).toLocaleString("ar-SD"):"—"}</td></tr>)}</tbody></table>{rows.length===0&&<p className="admin-no-data">لا توجد إجراءات مسجلة حتى الآن. ستظهر الإجراءات الجديدة هنا تلقائياً.</p>}<p className="admin-stats-note">يعرض السجل آخر 500 إجراء. اسم المنفّذ ودوره محفوظان وقت تنفيذ الإجراء ولا يتغيران بتغيير بيانات الحساب لاحقاً.</p></div>}
  </section>;
}
