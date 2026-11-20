"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { CheckCircle2, UserRound, ChevronLeft, ShieldCheck, ClipboardList, ScanLine, Pencil, Trash2, Scale, LockKeyhole, Info, FileText } from "lucide-react";
import AdvertiserWorkspace from "../../advertiser/components/AdvertiserWorkspace";
import { PushNotificationSettings } from "./PushNotificationSettings";

type AuthUser = { id: string; email?: string } | null;

type ProfileWorkspaceProps = {
  authUser: AuthUser;
  userId: string | null;
  userRole: string;
  fullName: string;
  setFullName: (value: string) => void;
  email: string;
  phone: string;
  setPhone: (value: string) => void;
  avatarUrl: string;
  profileEditing: boolean;
  setProfileEditing: (value: boolean) => void;
  saved: boolean;
  setSaved: (value: boolean) => void;
  authMessage: string;
  setAuthMessage: (value: string) => void;
  profileSaving: boolean;
  deletingAccount: boolean;
  darkMode: boolean;
  setDarkMode: Dispatch<SetStateAction<boolean>>;
  showPrivacySecurity: boolean;
  setShowPrivacySecurity: (value: boolean) => void;
  saveProfile: () => void;
  signInWithGoogle: () => void;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  deleteAccount: () => void;
  signOut: () => void;
};

export function ProfileWorkspace({
  authUser, userId, userRole, fullName, setFullName, email, phone, setPhone, avatarUrl,
  profileEditing, setProfileEditing, saved, setSaved, authMessage,
  setAuthMessage, profileSaving, deletingAccount, darkMode, setDarkMode,
  showPrivacySecurity, setShowPrivacySecurity, saveProfile,
  signInWithGoogle, deleteAccount, signOut,
}: ProfileWorkspaceProps) {
  const [legalPage, setLegalPage] = useState<"terms" | "privacy">("privacy");
  return (
    <>
{!showPrivacySecurity&&<section className="screen container profile-screen">
   <div className="profile-card profile-account-card">
    <div className="profile-account-head">
     <div className="profile-avatar-wrap"><div className="profile-avatar profile-avatar-large">{avatarUrl?<img src={avatarUrl} alt="صورة المستخدم"/>:<UserRound size={34}/>}</div>{authUser&&!profileEditing&&<button className="profile-avatar-edit" type="button" aria-label="تعديل البيانات" title="تعديل البيانات" onClick={()=>{setProfileEditing(true);setAuthMessage("");setSaved(false);}}><Pencil size={15}/></button>}</div>
     <div className="profile-account-identity"><strong>{authUser?(fullName.trim()||"مستخدم حاضر"):(fullName.trim()||"ضيف حاضر")}</strong><p>{authUser?.email||email||"لم تسجل الدخول بعد"}</p>{authUser && ["owner","admin","supervisor","organizer","gatekeeper","advertiser"].includes(userRole) && <small className="account-type">{({owner:"مالك المنصة",admin:"مشرف إداري",supervisor:"موظف حاضر",organizer:"بواب",gatekeeper:"بواب",advertiser:"معلن"} as Record<string,string>)[userRole]}</small>}</div>
    </div>
    {authUser&&<div className="profile-info-list"><div><span>الاسم</span><strong>{fullName.trim()||"غير محدد"}</strong></div><div><span>البريد الإلكتروني</span><strong dir="ltr">{authUser.email||email||"—"}</strong></div><div><span>رقم الهاتف</span><strong dir="ltr">{phone||"لم تتم إضافته بعد"}</strong></div></div>}
    {authUser&&profileEditing&&<form className="profile-form profile-form-unified" onSubmit={e=>{e.preventDefault();void saveProfile();}}><label>الاسم الكامل<input type="text" autoComplete="name" value={fullName} onChange={e=>{setFullName(e.target.value);setSaved(false);}} placeholder="اكتب اسمك الكامل" maxLength={100} required/></label><label>رقم الهاتف السوداني<input type="tel" inputMode="numeric" autoComplete="tel-national" value={phone} onChange={e=>{setPhone(e.target.value.replace(/[^0-9٠-٩]/g,"").slice(0,10));setSaved(false);}} placeholder="09XXXXXXXX" maxLength={10} dir="ltr" required/></label><p className="profile-save-note">أدخل 10 أرقام بالضبط، ويبدأ الرقم بصفر. مثال: 09XXXXXXXX</p><div className="profile-edit-actions"><button className="btn btn-primary" type="submit" disabled={profileSaving}>{profileSaving?"جاري الحفظ...":"حفظ البيانات"}</button><button className="btn btn-outline" type="button" onClick={()=>{setProfileEditing(false);setAuthMessage("");}}>إلغاء</button></div></form>}
    {!authUser&&<div className="auth-card" style={{marginTop:18}}><h2>سجّل الدخول إلى حاضر</h2><p>تصفح الفعاليات متاح للجميع. سجّل الدخول لحفظ بياناتك ومتابعة حجوزاتك.</p><button className="btn btn-primary pay-button" type="button" onClick={signInWithGoogle}><span aria-hidden="true" className="google-mark">G</span> المتابعة باستخدام Google</button></div>}
    {saved&&<div className="profile-save-success" role="status" aria-live="polite"><span className="profile-save-success-icon"><CheckCircle2 size={17}/></span><span><strong>تم الحفظ بنجاح</strong><small>اتحدّثت بيانات ملفك الشخصي.</small></span></div>}{authMessage&&<p className={authMessage.startsWith("تم تسجيل الخروج")?"profile-save-success":"profile-save-error"} role={authMessage.startsWith("تم تسجيل الخروج")?"status":"alert"} aria-live="polite">{authMessage}</p>}
   </div>
 <div className="profile-settings-panel"><div className="profile-settings-content"><div className="profile-settings-heading"><strong>الإعدادات</strong><p>تحكم في مظهر التطبيق والإشعارات الخارجية.</p></div><div className="profile-setting-row"><div className="profile-setting-copy"><strong>الوضع الليلي</strong><small>تغيير مظهر المنصة بالكامل</small></div><button className={"profile-setting-switch"+(darkMode?" is-on":"")} type="button" role="switch" aria-label="الوضع الليلي" aria-checked={darkMode} onClick={()=>setDarkMode(v=>!v)}><span aria-hidden="true"/></button></div>{authUser&&<PushNotificationSettings userId={userId}/>}</div></div>
{authUser&&<section className="role-workspace-section" aria-label="واجهات العمل">
  {(userRole==="owner"||userRole==="admin")&&<button type="button" className="role-workspace-button" onClick={()=>window.location.assign("/admin")}><span className="role-workspace-icon"><ShieldCheck size={21}/></span><span><strong>لوحة الإدارة</strong><small>إدارة المنصة والموظفين والفعاليات والحجوزات</small></span><ChevronLeft size={18}/></button>}
  {userRole==="supervisor"&&<button type="button" className="role-workspace-button" onClick={()=>window.location.assign("/admin")}><span className="role-workspace-icon"><ClipboardList size={21}/></span><span><strong>لوحة الإشراف</strong><small>مراجعة الحجوزات وإثباتات الدفع واتخاذ قرار القبول أو الرفض</small></span><ChevronLeft size={18}/></button>}
   {(userRole==="gatekeeper"||userRole==="organizer")&&<button type="button" className="role-workspace-button" onClick={()=>window.location.assign("/?tab=profile&workspace=gatekeeper")}><span className="role-workspace-icon"><ScanLine size={21}/></span><span><strong>مسح التذاكر</strong><small>فحص تذاكر الفعالية وتأكيد دخول الحضور</small></span><ChevronLeft size={18}/></button>}
  {userRole==="advertiser"&&<AdvertiserWorkspace authUser={authUser} userRole={userRole}/>}

 </section>}
 <section className="profile-legal-group" aria-labelledby="profile-legal-title">
  <div className="profile-legal-heading"><div><strong id="profile-legal-title">الوثائق والسياسات</strong><p>اطّلع على حقوقك والتزاماتك وكيفية التعامل مع بياناتك.</p></div><span>حاضر</span></div>
  <div className="profile-legal-actions" style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
  <button type="button" className="role-workspace-button privacy-entry-button" style={{minWidth:0,width:"100%",padding:"14px 12px",gap:8}} onClick={()=>{setLegalPage("terms");setShowPrivacySecurity(true);window.scrollTo({top:0,behavior:"auto"});}}>
   <span className="profile-legal-icon terms"><Scale size={21}/></span><span><strong>الشروط والأحكام</strong><small>قواعد استخدام المنصة وحقوق المستخدم والمنظم</small></span><span className="profile-legal-action">قراءة الوثيقة <ChevronLeft size={16}/></span>
  </button>
  <button type="button" className="role-workspace-button privacy-entry-button" style={{minWidth:0,width:"100%",padding:"14px 12px",gap:8}} onClick={()=>{setLegalPage("privacy");setShowPrivacySecurity(true);window.scrollTo({top:0,behavior:"auto"});}}>
   <span className="profile-legal-icon privacy"><LockKeyhole size={21}/></span><span><strong>سياسة الخصوصية</strong><small>البيانات التي نتعامل معها وطرق حمايتها</small></span><span className="profile-legal-action">قراءة الوثيقة <ChevronLeft size={16}/></span>
  </button>
  </div>
 </section>

 {authUser&&<button className="btn profile-logout-button role-logout-button" type="button" onClick={signOut}>تسجيل الخروج</button>}
 </section>}

 
{showPrivacySecurity&&<section className="screen container privacy-screen" id="legal-documents">
  <div className={`legal-page-hero ${legalPage==="terms"?"legal-page-terms":"legal-page-privacy"}`}>
   <div className="legal-page-kicker"><span>حاضر</span><span>الوثائق والسياسات</span></div>
   <div className="legal-page-heading">
    <span className="legal-page-symbol">{legalPage==="terms"?<FileText size={25}/>:<ShieldCheck size={25}/>}</span>
    <div><h1>{legalPage==="terms"?"الشروط والأحكام":"سياسة الخصوصية"}</h1><p>{legalPage==="terms"?"القواعد التي تنظّم استخدام منصة حاضر وتوضح حقوق والتزامات جميع الأطراف.":"كيف نتعامل مع بياناتك، ولماذا نحتاجها، وما الضوابط التي تحكم استخدامها."}</p></div>
   </div>
   <div className="legal-page-note"><Info size={17}/><span>{legalPage==="terms"?"يرجى قراءة البنود الخاصة بالمستخدم والمنظم قبل استخدام خدمات المنصة.":"نلتزم باستخدام البيانات في حدود تشغيل حاضر وإدارة الحسابات والحجوزات."}</span></div>
  </div>
  <div className="legal-content-heading"><div><strong>{legalPage==="terms"?"بنود الشروط والأحكام":"بنود سياسة الخصوصية"}</strong><small>اضغط على أي بند لعرض تفاصيله</small></div><span>{legalPage==="terms"?"03 بنود":"03 بنود"}</span></div>
  {legalPage==="terms" ? <>
   <div className="legal-accordion-list">
    <details className="legal-accordion"><summary>شروط وأحكام المستخدم</summary><div className="legal-accordion-content">
     <p>تتيح حاضر تصفح الفعاليات المنشورة وحجز التذاكر وتسهيل الوصول إليها. يلتزم المستخدم بصحة بياناته والمحافظة على حسابه واستخدام التذكرة وفق بياناتها وعدم تزويرها أو إعادة استخدامها.</p>
     <p>لا يُعد رفع إثبات التحويل تأكيداً نهائياً للحجز قبل مراجعته واعتماده. ويكون سعر التذكرة والبيانات المعروضة قبل الدفع هي المرجع للحجز.</p>
     <p>لا يحق طلب استرداد قيمة التذكرة بعد إتمام الحجز والدفع، إلا عند إلغاء الفعالية أو في الحالات الاستثنائية التي تقرر فيها حاضر إتاحة الاسترداد. وعند التأجيل، تحدث حاضر التاريخ والوقت المعلنين، ويتولى المنظم التواصل مع المشترين بشأن الترتيبات.</p>
     <p>تقع مسؤولية حضور المستخدم في الموعد والمكان المحددين عليه، ولا ينشأ عن عدم الحضور حق تلقائي في الاسترداد.</p>
    </div></details>
    <details className="legal-accordion"><summary>شروط وأحكام المنظم وصاحب الفعالية</summary><div className="legal-accordion-content">
     <p>حاضر منصة إلكترونية لتسهيل عرض الفعاليات والحجوزات وتوفير التذاكر، وليست الجهة المنظمة أو المنفذة للفعالية. يتحمل المنظم مسؤولية التنظيم والتنفيذ والتصاريح والخدمات الميدانية وصحة المعلومات المنشورة والالتزام بها.</p>
     <p>يحدد المنظم سعر التذكرة بنفسه، وتُخصم عمولة حاضر من مستحقاته وفق النسبة المتفق عليها لكل فعالية، دون إضافة عمولة من حاضر على المشتري. ولا تُغيّر النسبة بأثر رجعي على الحجوزات السابقة.</p>
     <p>يلتزم المنظم بإبلاغ حاضر فور إلغاء الفعالية أو تأجيلها. عند التأجيل، تحدث حاضر التاريخ والوقت فقط، ويتولى المنظم التواصل مع المشترين. وعند الإلغاء، يتعاون المنظم في إعادة المبالغ المستحقة. وإذا كانت الأموال قد حُولت إليه مباشرة، تتابعه حاضر وتطالبه بإعادتها دون التزامها بالدفع من أموالها الخاصة نيابة عنه.</p>
     <p>يتحمل المنظم معالجة الشكاوى المتعلقة بالتنظيم والتنفيذ الميداني. وتحتفظ حاضر بحق رفض نشر الفعالية أو تعليقها أو إزالتها عند مخالفة القانون أو سياسات المنصة أو نشر معلومات مضللة، مع مراعاة الحجوزات القائمة وحقوق المشترين.</p>
     <p>يلتزم المنظم بسرية بيانات المشترين، ويقتصر استخدامها على ما يلزم لتنفيذ الفعالية والتواصل بشأنها. ويحظر استخدامها للتسويق أو مشاركتها مع الغير دون موافقة المستخدم أو مسوغ قانوني.</p>
    </div></details>
    <details className="legal-accordion"><summary>الأحكام العامة</summary><div className="legal-accordion-content">
     <p>تسري هذه الأحكام على جميع مستخدمي حاضر والمنظمين، وتكمل الشروط الخاصة بكل فئة. تقتصر مسؤولية حاضر على الخدمات التقنية وخدمات العرض والحجز والتذاكر التي تقدمها مباشرة، ولا يعني نشر الفعالية ضمان تنفيذها.</p>
     <p>يجوز لحاضر تحديث الوثائق عند الحاجة، مع إظهار التعديلات الجوهرية وطلب موافقة جديدة عندما يكون ذلك لازماً. ولا تسقط إزالة الفعالية حقوق المشترين أو التزامات المنظم القائمة.</p>
     <p className="privacy-note">حاضر حالياً مشروع منصة تحت التطوير، وسيتم استكمال بيانات الكيان القانوني وتحديث الوثائق عند استكمال إجراءات التسجيل الرسمية.</p>
    </div></details>
   </div>
  </> : <>
   <div className="legal-accordion-list">
    <details className="legal-accordion"><summary>مشاركة البيانات</summary><div className="legal-accordion-content">
     <h3>لا نبيع بياناتك ولا نستخدمها للإعلانات</h3><p>لا يبيع حاضر بيانات المستخدمين ولا يشاركها مع جهات خارجية لأغراض إعلانية. وقد يطلع المنظم على بيانات المشترين بالقدر اللازم لتنفيذ الفعالية والتواصل بشأنها، ويلتزم بعدم استخدامها للتسويق أو لأي غرض آخر دون موافقة المستخدم أو مسوغ قانوني. كما نستعين بمزوّدي خدمات تقنية لتشغيل التطبيق، وقد تتم معالجة البيانات الضرورية لديهم، مثل الاستضافة وقاعدة البيانات وتسجيل الدخول.</p>
     <p className="privacy-note">قد يشمل ذلك خدمات Supabase وVercel، وخدمة Google عند اختيار تسجيل الدخول باستخدام Google.</p>
    </div></details>
    <details className="legal-accordion"><summary>البيانات التي نجمعها</summary><div className="legal-accordion-content">
     <p>قد يجمع التطبيق البيانات التالية بحسب استخدامك:</p>
     <h3>المعلومات الشخصية</h3><p>نجمع الاسم ورقم الجوال والبريد الإلكتروني المرتبط بالحساب بحسب ما تقدمه عند التسجيل أو تحديث الملف الشخصي.</p>
     <p><b>لماذا نحتاج رقم الجوال؟</b> للتواصل معك عند وجود مشكلة في الحجز أو الدفع، ومساعدتك في تأكيد التذكرة أو حل مشكلة متعلقة بالدخول للفعالية. لا نستخدمه للتسويق العشوائي.</p>
     <p><b>لماذا نحتاج البريد الإلكتروني؟</b> لإنشاء الحساب وتسجيل الدخول، وربط حجوزاتك بحسابك، وإرسال رسائل تأكيد الحجز والتحديثات المهمة، والمساعدة في استعادة الوصول إلى الحساب.</p>
     <p className="privacy-note">قد يكون رقم الجوال مطلوباً لبعض خطوات الحجز والتواصل التشغيلي، بينما يبقى البريد الإلكتروني معرّف الحساب الأساسي.</p>
     <h3>بيانات الحجوزات والتذاكر</h3><p>الفعاليات التي تحجزها، تفاصيل التذاكر، وحالة الحجز والإشعارات المرتبطة به.</p>
     <h3>بيانات الدفع</h3><p>إيصال التحويل الذي ترفعه لإثبات الدفع، ومعلومات المعاملة اللازمة لمراجعة الحجز. لا تطلب منك صفحة حاضر إدخال كلمة مرور حسابك البنكي.</p>
     <h3>بيانات تقنية</h3><p>قد تُعالج معلومات تقنية لازمة لتشغيل التطبيق وحماية الحساب وتحسين استقراره.</p>
    </div></details>
    <details className="legal-accordion"><summary>كيف نحمي بياناتك؟</summary><div className="legal-accordion-content">
     <h3>تشفير البيانات أثناء النقل</h3><p>يتم نقل البيانات عبر اتصال آمن مشفّر (HTTPS/TLS) بين جهازك وخدمات التطبيق.</p>
     <p className="privacy-note">نطبّق ضوابط وصول لحماية بيانات الحساب، ولا نعرض بياناتك الخاصة للمستخدمين الآخرين.</p>
    </div></details>
   </div>
   <article className="privacy-section-card privacy-delete-card">
    <span className="privacy-icon"><Trash2 size={25}/></span><h2>حذف الحساب والبيانات</h2><p>يمكنك طلب حذف حسابك والبيانات المرتبطة به. ستُزال بيانات الاسم والبريد والجوال من سجل الحجوزات مع الإبقاء على السجلات المالية الضرورية بصورة مجهّلة لأغراض التدقيق وحماية حقوق الأطراف.</p>
    {authUser?<button type="button" className="privacy-danger-button" onClick={deleteAccount} disabled={deletingAccount}><Trash2 size={17}/>{deletingAccount?"جارٍ حذف الحساب...":"حذف حسابي نهائياً"}</button>:<p className="privacy-pending-label">سجّل الدخول إلى حسابك لطلب الحذف</p>}
    {authMessage&&<p className="privacy-delete-error" role="alert">{authMessage}</p>}
   </article>
  </>}
 </section>}
  
    </>
  );
}
