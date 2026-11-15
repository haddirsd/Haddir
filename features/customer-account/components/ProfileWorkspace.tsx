"use client";

import { type Dispatch, type SetStateAction } from "react";
import { CheckCircle2, UserRound, ChevronLeft, ShieldCheck, ClipboardList, ScanLine, Pencil, Share2, CloudUpload, LockKeyhole, Trash2, Ticket } from "lucide-react";
import AdvertiserWorkspace from "../../advertiser/components/AdvertiserWorkspace";

type AuthUser = { id: string; email?: string } | null;

type ProfileWorkspaceProps = {
  authUser: AuthUser;
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
  deleteAccount: () => void;
  signOut: () => void;
};

export function ProfileWorkspace({
  authUser, userRole, fullName, setFullName, email, phone, setPhone, avatarUrl,
  profileEditing, setProfileEditing, saved, setSaved, authMessage,
  setAuthMessage, profileSaving, deletingAccount, darkMode, setDarkMode,
  showPrivacySecurity, setShowPrivacySecurity, saveProfile,
  signInWithGoogle, deleteAccount, signOut,
}: ProfileWorkspaceProps) {
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
{authUser&&<section className="role-workspace-section" aria-label="واجهات العمل">
  {(userRole==="owner"||userRole==="admin")&&<button type="button" className="role-workspace-button" onClick={()=>window.location.assign("/admin")}><span className="role-workspace-icon"><ShieldCheck size={21}/></span><span><strong>لوحة الإدارة</strong><small>إدارة المنصة والموظفين والفعاليات والحجوزات</small></span><ChevronLeft size={18}/></button>}
  {userRole==="supervisor"&&<button type="button" className="role-workspace-button" onClick={()=>window.location.assign("/admin")}><span className="role-workspace-icon"><ClipboardList size={21}/></span><span><strong>لوحة الإشراف</strong><small>مراجعة الحجوزات وإثباتات الدفع واتخاذ قرار القبول أو الرفض</small></span><ChevronLeft size={18}/></button>}
   {(userRole==="gatekeeper"||userRole==="organizer")&&<button type="button" className="role-workspace-button" onClick={()=>window.location.assign("/?tab=profile&workspace=gatekeeper")}><span className="role-workspace-icon"><ScanLine size={21}/></span><span><strong>مسح التذاكر</strong><small>فحص تذاكر الفعالية وتأكيد دخول الحضور</small></span><ChevronLeft size={18}/></button>}
  {userRole==="advertiser"&&<AdvertiserWorkspace authUser={authUser} userRole={userRole}/>}

 </section>}
 <button type="button" className="role-workspace-button privacy-entry-button" onClick={()=>{setShowPrivacySecurity(true);window.scrollTo({top:0,behavior:"auto"});}}><span className="role-workspace-icon"><ShieldCheck size={21}/></span><span><strong>الخصوصية والأمان</strong><small>معلومات بياناتك وكيفية حمايتها وإدارتها</small></span><ChevronLeft size={18}/></button>
 <div className="profile-settings-panel"><div><strong>إعدادات العرض</strong><p>غيّر مظهر التطبيق في كل الصفحات.</p></div><button className="btn btn-outline" type="button" onClick={()=>setDarkMode(v=>!v)}>{darkMode?"☀ الوضع النهاري":"☾ الوضع الليلي"}</button></div>
 {authUser&&<button className="btn profile-logout-button role-logout-button" type="button" onClick={signOut}>تسجيل الخروج</button>}
 </section>}

 
{showPrivacySecurity&&<section className="screen container privacy-screen" id="legal-documents">
  <div className="privacy-intro"><span className="privacy-eyebrow">حاضر • الخصوصية والأمان</span><h1>أمان البيانات</h1><p>نوضح ليك هنا أنواع المعلومات التي قد يجمعها تطبيق حاضر، وكيفية استخدامها وحمايتها. قد تختلف بعض الممارسات حسب طريقة استخدامك للتطبيق والميزات التي تستعملها.</p></div>

  <article className="privacy-section-card legal-document-card" id="user-terms">
   <span className="privacy-icon"><ShieldCheck size={25}/></span><h2>شروط وأحكام المستخدم</h2>
   <p>تتيح حاضِر تصفح الفعاليات المنشورة وحجز التذاكر وتسهيل الوصول إليها. يلتزم المستخدم بصحة بياناته والمحافظة على حسابه واستخدام التذكرة وفق بياناتها وعدم تزويرها أو إعادة استخدامها.</p>
   <p>لا يُعد رفع إثبات التحويل تأكيداً نهائياً للحجز قبل مراجعته واعتماده. ويكون سعر التذكرة والبيانات المعروضة قبل الدفع هي المرجع للحجز.</p>
   <p>لا يحق طلب استرداد قيمة التذكرة بعد إتمام الحجز والدفع، إلا عند إلغاء الفعالية أو في الحالات الاستثنائية التي تقرر فيها حاضِر إتاحة الاسترداد. وعند التأجيل، تحدث حاضِر التاريخ والوقت المعلنين، ويتولى المنظم التواصل مع المشترين بشأن الترتيبات.</p>
   <p>تقع مسؤولية حضور المستخدم في الموعد والمكان المحددين عليه، ولا ينشأ عن عدم الحضور حق تلقائي في الاسترداد.</p>
  </article>
  <article className="privacy-section-card legal-document-card" id="organizer-terms">
   <span className="privacy-icon"><ClipboardList size={25}/></span><h2>شروط وأحكام المنظم وصاحب الفعالية</h2>
   <p>حاضِر منصة إلكترونية لتسهيل عرض الفعاليات والحجوزات وتوفير التذاكر، وليست الجهة المنظمة أو المنفذة للفعالية. يتحمل المنظم مسؤولية التنظيم والتنفيذ والتصاريح والخدمات الميدانية وصحة المعلومات المنشورة والالتزام بها.</p>
   <p>يحدد المنظم سعر التذكرة بنفسه، وتُخصم عمولة حاضِر من مستحقاته وفق النسبة المتفق عليها لكل فعالية، دون إضافة عمولة من حاضِر على المشتري. ولا تُغيّر النسبة بأثر رجعي على الحجوزات السابقة.</p>
   <p>يلتزم المنظم بإبلاغ حاضِر فور إلغاء الفعالية أو تأجيلها. عند التأجيل، تحدث حاضِر التاريخ والوقت فقط، ويتولى المنظم التواصل مع المشترين. وعند الإلغاء، يتعاون المنظم في إعادة المبالغ المستحقة. وإذا كانت الأموال قد حُولت إليه مباشرة، تتابعه حاضِر وتطالبه بإعادتها دون التزامها بالدفع من أموالها الخاصة نيابة عنه.</p>
   <p>يتحمل المنظم معالجة الشكاوى المتعلقة بالتنظيم والتنفيذ الميداني. وتحتفظ حاضِر بحق رفض نشر الفعالية أو تعليقها أو إزالتها عند مخالفة القانون أو سياسات المنصة أو نشر معلومات مضللة، مع مراعاة الحجوزات القائمة وحقوق المشترين.</p>
   <p>يلتزم المنظم بسرية بيانات المشترين، ويقتصر استخدامها على ما يلزم لتنفيذ الفعالية والتواصل بشأنها. ويحظر استخدامها للتسويق أو مشاركتها مع الغير دون موافقة المستخدم أو مسوغ قانوني.</p>
  </article>
  <article className="privacy-section-card legal-document-card" id="general-terms">
   <span className="privacy-icon"><ShieldCheck size={25}/></span><h2>الأحكام العامة</h2>
   <p>تسري هذه الأحكام على جميع مستخدمي حاضِر والمنظمين، وتكمل الشروط الخاصة بكل فئة. تقتصر مسؤولية حاضِر على الخدمات التقنية وخدمات العرض والحجز والتذاكر التي تقدمها مباشرة، ولا يعني نشر الفعالية ضمان تنفيذها.</p>
   <p>يجوز لحاضِر تحديث الوثائق عند الحاجة، مع إظهار التعديلات الجوهرية وطلب موافقة جديدة عندما يكون ذلك لازماً. ولا تسقط إزالة الفعالية حقوق المشترين أو التزامات المنظم القائمة.</p>
   <p className="privacy-note">حاضِر حالياً مشروع منصة تحت التطوير، وسيتم استكمال بيانات الكيان القانوني وتحديث الوثائق عند استكمال إجراءات التسجيل الرسمية.</p>
  </article>
  <article className="privacy-section-card">
   <span className="privacy-icon"><Share2 size={25}/></span><h2>مشاركة البيانات</h2><h3>لا نبيع بياناتك ولا نستخدمها للإعلانات</h3><p>لا يبيع حاضر بيانات المستخدمين ولا يشاركها مع جهات خارجية لأغراض إعلانية. وقد يطلع المنظم على بيانات المشترين بالقدر اللازم لتنفيذ الفعالية والتواصل بشأنها، ويلتزم بعدم استخدامها للتسويق أو لأي غرض آخر دون موافقة المستخدم أو مسوغ قانوني. كما نستعين بمزوّدي خدمات تقنية لتشغيل التطبيق، وقد تتم معالجة البيانات الضرورية لديهم، مثل الاستضافة وقاعدة البيانات وتسجيل الدخول.</p><p className="privacy-note">قد يشمل ذلك خدمات Supabase وVercel، وخدمة Google عند اختيار تسجيل الدخول باستخدام Google.</p>
  </article>
  <article className="privacy-section-card">
   <span className="privacy-icon"><CloudUpload size={25}/></span><h2>البيانات المجمّعة</h2><p>قد يجمع التطبيق البيانات التالية بحسب استخدامك:</p>
   <div className="privacy-data-group"><strong><UserRound size={17}/> المعلومات الشخصية</strong><p>نجمع الاسم ورقم الجوال والبريد الإلكتروني المرتبط بالحساب بحسب ما تقدمه عند التسجيل أو تحديث الملف الشخصي.</p><p><b>لماذا نحتاج رقم الجوال؟</b> للتواصل معك عند وجود مشكلة في الحجز أو الدفع، ومساعدتك في تأكيد التذكرة أو حل مشكلة متعلقة بالدخول للفعالية. لا نستخدمه للتسويق العشوائي.</p><p><b>لماذا نحتاج البريد الإلكتروني؟</b> لإنشاء الحساب وتسجيل الدخول، وربط حجوزاتك بحسابك، وإرسال رسائل تأكيد الحجز والتحديثات المهمة، والمساعدة في استعادة الوصول إلى الحساب.</p><p className="privacy-note">قد يكون رقم الجوال مطلوباً لبعض خطوات الحجز والتواصل التشغيلي، بينما يبقى البريد الإلكتروني معرّف الحساب الأساسي.</p></div>
   <div className="privacy-data-group"><strong><Ticket size={17}/> بيانات الحجوزات والتذاكر</strong><p>الفعاليات التي تحجزها، تفاصيل التذاكر، وحالة الحجز والإشعارات المرتبطة به.</p></div>
   <div className="privacy-data-group"><strong><Share2 size={17}/> بيانات الدفع</strong><p>إيصال التحويل الذي ترفعه لإثبات الدفع، ومعلومات المعاملة اللازمة لمراجعة الحجز. لا تطلب منك صفحة حاضر إدخال كلمة مرور حسابك البنكي.</p></div>
   <div className="privacy-data-group"><strong><LockKeyhole size={17}/> بيانات تقنية</strong><p>قد تُعالج معلومات تقنية لازمة لتشغيل التطبيق وحماية الحساب وتحسين استقراره.</p></div>
  </article>
  <article className="privacy-section-card">
   <span className="privacy-icon"><LockKeyhole size={25}/></span><h2>الممارسات المتعلقة بالأمان</h2><div className="privacy-security-row"><LockKeyhole size={21}/><div><strong>تشفير البيانات أثناء النقل</strong><p>يتم نقل البيانات عبر اتصال آمن مشفّر (HTTPS/TLS) بين جهازك وخدمات التطبيق.</p></div></div><p className="privacy-note">نطبّق ضوابط وصول لحماية بيانات الحساب، ولا نعرض بياناتك الخاصة للمستخدمين الآخرين.</p>
  </article>
  <article className="privacy-section-card privacy-delete-card">
   <span className="privacy-icon"><Trash2 size={25}/></span><h2>حذف البيانات</h2><p>يمكنك طلب حذف حسابك والبيانات المرتبطة به، أو طلب حذف بيانات محددة دون حذف الحساب بالكامل.</p>
   <div className="privacy-delete-option"><h3>حذف حساب التطبيق</h3><p>سيتم حذف تسجيل الدخول والملف الشخصي وإيصالات التحويل والإشعارات واشتراكات الإشعارات. وستُزال بيانات الاسم والبريد والجوال من سجل الحجوزات مع الإبقاء على السجلات المالية الضرورية بصورة مجهّلة لأغراض التدقيق وحماية حقوق الأطراف.</p>{authUser?<button type="button" className="privacy-danger-button" onClick={deleteAccount} disabled={deletingAccount}><Trash2 size={17}/>{deletingAccount?"جارٍ حذف الحساب...":"حذف حسابي نهائياً"}</button>:<p className="privacy-pending-label">سجّل الدخول إلى حسابك لطلب الحذف</p>}{authMessage&&<p className="privacy-delete-error" role="alert">{authMessage}</p>}</div>
   <div className="privacy-delete-option"><h3>إدارة بيانات التطبيق</h3><p>حذف الحساب يزيل بيانات الملف الشخصي وإيصالات الدفع المرتبطة بحجوزاتك. أما سجلات المعاملات والتذاكر اللازمة للتدقيق وإثبات العمليات فتبقى محفوظة بعد إزالة بيانات تعريفك الشخصية.</p></div>
  </article>
 </section>}
  
    </>
  );
}
