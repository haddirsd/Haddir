"use client";

import { useMemo, useState } from "react";
import { Activity, CalendarDays, RefreshCw, Search, SlidersHorizontal, UserRound, X } from "lucide-react";
import { useAdminActivity } from "./useAdminActivity";
import type { AdminActivityRow } from "./admin-activity.types";

const actionNames:Record<string,string>={"events.created":"أضاف فعالية","events.updated":"عدّل بيانات فعالية","events.deleted":"حذف فعالية","event.cancelled":"ألغى فعالية / أخفاها","event.published":"نشر فعالية","profiles.created":"أضاف عميلاً / مستخدماً","user.role_changed":"غيّر دور مستخدم","bookings.created":"أنشأ حجزاً","booking.confirmed":"وافق على الحجز","booking.rejected":"رفض الحجز","payment.approved":"اعتمد إثبات الدفع","payment.rejected":"رفض إثبات الدفع","ticket.checked_in":"أكد دخول التذكرة","tickets.deleted":"حذف تذكرة","ticket.checkin_reversed":"ألغى تأكيد دخول التذكرة","ticket.status_changed":"عدّل حالة التذكرة","ticket_types.created":"أضاف فئة تذاكر","ticket_types.updated":"عدّل فئة تذاكر","ticket_types.deleted":"حذف فئة تذاكر","event_payment_accounts.created":"أضاف حساب دفع","event_payment_accounts.updated":"عدّل حساب دفع","event_payment_accounts.deleted":"حذف حساب دفع"};
const roleNames:Record<string,string>={owner:"مالك المنصة",admin:"مشرف",supervisor:"موظف حاضر",gatekeeper:"بواب",organizer:"بواب",advertiser:"معلن",customer:"عميل",unknown:"غير معروف"};
const fieldNames:Record<string,string>={title:"اسم الفعالية",status:"الحالة",description:"الوصف",venue:"المكان",city:"المدينة",starts_at:"موعد البداية",ends_at:"موعد النهاية",platform_fee_percent:"نسبة العمولة",role:"الدور",full_name:"الاسم",is_trending:"رائج الآن",price:"السعر",quantity_total:"الكمية",name:"الاسم",is_active:"التفعيل",account_name:"طريقة الدفع",account_number:"رقم الحساب",beneficiary:"المستفيد"};
const actionGroup=(action:string)=>action.split(".")[0]||"other";
const groupNames:Record<string,string>={events:"الفعاليات",event:"الفعاليات",profiles:"المستخدمون",user:"المستخدمون",bookings:"الحجوزات",booking:"الحجوزات",payment:"المدفوعات",ticket:"التذاكر",tickets:"التذاكر",ticket_types:"فئات التذاكر",event_payment_accounts:"حسابات الدفع"};
const pretty=(value:unknown)=>{if(value===null||value===undefined||value==="")return "—";if(typeof value==="boolean")return value?"مفعّل":"غير مفعّل";if(typeof value==="object")return JSON.stringify(value);return String(value);};
const detailText=(details:Record<string,unknown>|null)=>Object.entries(details||{}).map(([key,value])=>{
  if(value&&typeof value==="object"&&("before" in value||"after" in value)){
    const change=value as {before?:unknown;after?:unknown};
    return {label:fieldNames[key]||key,value:`من ${pretty(change.before)} ← إلى ${pretty(change.after)}`};
  }
  return {label:fieldNames[key]||key,value:pretty(value)};
});

export default function AdminActivityWorkspace() {
  const { rows, loading, error, refresh } = useAdminActivity();
  const [search,setSearch]=useState("");
  const [roleFilter,setRoleFilter]=useState("all");
  const [groupFilter,setGroupFilter]=useState("all");
  const [period,setPeriod]=useState("all");
  const todayStart=new Date();todayStart.setHours(0,0,0,0);
  const filtered=useMemo(()=>{
    const term=search.trim().toLocaleLowerCase("ar");
    const cutoff=period==="today"?todayStart.getTime():period==="7d"?Date.now()-7*86400000:period==="30d"?Date.now()-30*86400000:0;
    return rows.filter(row=>{
      const group=actionGroup(row.action);
      const haystack=[row.actor_name,row.actor_role,row.action,actionNames[row.action],row.entity_label,row.entity_type,row.events?.title,...detailText(row.details).flatMap(item=>[item.label,item.value])].filter(Boolean).join(" ").toLocaleLowerCase("ar");
      return (!term||haystack.includes(term))&&(roleFilter==="all"||row.actor_role===roleFilter)&&(groupFilter==="all"||group===groupFilter)&&(!cutoff||new Date(row.created_at).getTime()>=cutoff);
    });
  },[rows,search,roleFilter,groupFilter,period]);
  const todayCount=rows.filter(row=>new Date(row.created_at).getTime()>=todayStart.getTime()).length;
  const uniqueActors=new Set(rows.map(row=>row.actor_name).filter(Boolean)).size;
  const hasFilters=!!search||roleFilter!=="all"||groupFilter!=="all"||period!=="all";
  const reset=()=>{setSearch("");setRoleFilter("all");setGroupFilter("all");setPeriod("all");};
  const dateLabel=(value:string)=>new Date(value).toLocaleString("ar-SD-u-nu-latn",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  return <section className="admin-panel admin-activity-workspace">
    <div className="admin-activity-heading">
      <div><span className="admin-activity-eyebrow"><Activity size={14}/> الشفافية والمتابعة</span><h3>سجل الإجراءات</h3><p>تابع العمليات التي ينفذها فريق حاضر، واعرف من قام بها ومتى وما الذي تغيّر.</p></div>
      <button className="admin-refresh" type="button" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={16}/> {loading?"جاري التحديث":"تحديث السجل"}</button>
    </div>
    {error&&<div className="admin-notice" role="alert">{error}</div>}
    <div className="admin-activity-stats">
      <article><span><Activity size={18}/></span><div><small>الإجراءات المعروضة</small><strong>{loading?"—":filtered.length.toLocaleString("ar-SD-u-nu-latn")}</strong></div></article>
      <article><span><CalendarDays size={18}/></span><div><small>إجراءات اليوم</small><strong>{loading?"—":todayCount.toLocaleString("ar-SD-u-nu-latn")}</strong></div></article>
      <article><span><UserRound size={18}/></span><div><small>منفذون مختلفون</small><strong>{loading?"—":uniqueActors.toLocaleString("ar-SD-u-nu-latn")}</strong></div></article>
    </div>
    <div className="admin-activity-filter-panel">
      <div className="admin-activity-filter-title"><div><SlidersHorizontal size={16}/><b>البحث والتصفية</b></div>{hasFilters&&<button type="button" onClick={reset}><X size={14}/> مسح الفلاتر</button>}</div>
      <div className="admin-activity-filters">
        <label className="admin-activity-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث باسم المنفّذ أو الإجراء أو الفعالية..."/></label>
        <label><span>نوع الإجراء</span><select value={groupFilter} onChange={e=>setGroupFilter(e.target.value)}><option value="all">كل العمليات</option><option value="events">الفعاليات</option><option value="event">إجراءات الفعالية</option><option value="bookings">الحجوزات</option><option value="booking">إجراءات الحجز</option><option value="payment">المدفوعات</option><option value="ticket">التذاكر</option><option value="tickets">إدارة التذاكر</option><option value="ticket_types">فئات التذاكر</option><option value="event_payment_accounts">حسابات الدفع</option><option value="user">المستخدمون</option><option value="profiles">الحسابات</option></select></label>
        <label><span>دور المنفّذ</span><select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}><option value="all">كل الأدوار</option>{Object.entries(roleNames).filter(([key])=>key!=="unknown").map(([key,value])=><option value={key} key={key}>{value}</option>)}</select></label>
        <label><span>الفترة الزمنية</span><select value={period} onChange={e=>setPeriod(e.target.value)}><option value="all">كل الفترات</option><option value="today">اليوم</option><option value="7d">آخر 7 أيام</option><option value="30d">آخر 30 يوماً</option></select></label>
      </div>
    </div>
    <div className="admin-activity-results-head"><div><h4>تفاصيل الإجراءات</h4><p>{loading?"يتم تحميل السجل...":`عرض ${filtered.length.toLocaleString("ar-SD-u-nu-latn")} من أصل ${rows.length.toLocaleString("ar-SD-u-nu-latn")} إجراء محمّل`}</p></div></div>
    {loading?<div className="admin-activity-empty"><span className="admin-spinner"/><p>جاري تحميل سجل الإجراءات...</p></div>:filtered.length===0?<div className="admin-activity-empty"><span><Search size={23}/></span><b>{rows.length?"لا توجد نتائج مطابقة":"لا توجد إجراءات مسجلة حتى الآن"}</b><p>{rows.length?"جرّب تغيير كلمات البحث أو الفلاتر المحددة.":"ستظهر هنا العمليات الجديدة التي ينفذها فريق الإدارة."}</p>{hasFilters&&<button type="button" onClick={reset}>عرض كل الإجراءات</button>}</div>:<div className="admin-activity-list">{filtered.map((row:AdminActivityRow,index:number)=>{
      const details=detailText(row.details);const group=actionGroup(row.action);
      return <article className="admin-activity-item" key={row.id||index}>
        <div className="admin-activity-item-rail"><span><Activity size={16}/></span></div>
        <div className="admin-activity-item-body">
          <div className="admin-activity-item-top"><div className="admin-activity-actor"><strong>{row.actor_name||"مستخدم غير معروف"}</strong><span>{roleNames[row.actor_role||"unknown"]||row.actor_role||"دور غير محدد"}</span></div><time dateTime={row.created_at}>{dateLabel(row.created_at)}</time></div>
          <div className="admin-activity-action"><b>{actionNames[row.action]||row.action}</b><span>{groupNames[group]||row.entity_type||"إجراء إداري"}</span></div>
          <div className="admin-activity-entity"><small>العنصر المرتبط</small><strong>{row.entity_label||row.events?.title||row.entity_type||"—"}</strong>{row.events?.title&&row.entity_label&&<span>{row.events.title}</span>}</div>
          {details.length>0&&<div className="admin-activity-changes"><small>تفاصيل التغيير</small><div>{details.map((item,i)=><span key={i}><b>{item.label}</b><em>{item.value}</em></span>)}</div></div>}
        </div>
      </article>;
    })}</div>}
    <p className="admin-activity-footnote">يعرض السجل آخر 500 إجراء محمّل من قاعدة البيانات، ويتحدّث تلقائياً عند تسجيل إجراءات جديدة.</p>
  </section>;
}
