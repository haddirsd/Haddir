"use client";

import { type Dispatch, type SetStateAction } from "react";
import { CheckCircle2, UserRound, ChevronLeft, ShieldCheck, ClipboardList, ScanLine, Pencil, Share2, CloudUpload, LockKeyhole, Trash2, Ticket } from "lucide-react";
import AdvertiserWorkspace from "../../advertiser/AdvertiserWorkspace";

type AuthUser = { id: string; email?: string } | null;

type ProfileWorkspaceProps = {
  authUser: AuthUser;
  userRole: string;
  fullName: string;
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
  authUser, userRole, fullName, email, phone, setPhone, avatarUrl,
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
    {authUser&&profileEditing&&<form className="profile-form profile-form-unified" onSubmit={e=>{e.preventDefault();void saveProfile();}}><label>رقم الهاتف السوداني<input type="tel" inputMode="numeric" autoComplete="tel-national" value={phone} onChange={e=>{setPhone(e.target.value.replace(/[^0-9٠-٩]/g,"").slice(0,10));setSaved(false);}} placeholder="09XXXXXXXX" maxLength={10} dir="ltr" required/></label><p className="profile-save-note">أدخل 10 أرقام بالضبط، ويبدأ الرقم بصفر. مثال: 09XXXXXXXX</p><div className="profile-edit-actions"><button className="btn btn-primary" type="submit" disabled={profileSaving}>{profileSaving?"جاري الحفظ...":"حفظ الرقم"}</button><button className="btn btn-outline" type="button" onClick={()=>{setProfileEditing(false);setAuthMessage("");}}>إلغاء</button></div></form>}
    {!authUser&&<div className="auth-card" style={{marginTop:18}}><h2>سجّل الدخول إلى حاضر</h2><p>تصفح الفعاليات متاح للجميع. سجّل الدخول لحفظ بياناتك ومتابعة حجوزاتك.</p><button className="btn btn-primary pay-button" type="button" onClick={signInWithGoogle}><span aria-hidden="true" className="google-mark">G</span> المتابعة باستخدام Google</button></div>}
    {saved&&<p className="save-confirm"><CheckCircle2 size={16}/> تم حفظ رقم الهاتف بنجاح.</p>}{authMessage&&<p className="profile-save-error" role="alert">{authMessage}</p>}
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
 {authMessage&&<p className="save-confirm">{authMessage}</p>}
 </section>}

 
{showPrivacySecurity&&<section className="screen container privacy-screen">
  <div className="privacy-intro"><span className="privacy-eyebrow">حاضر • الخصوصية والأمان</span><h1>أمان البيانات</h1><p>نوضح ليك هنا أنواع المعلومات التي قد يجمعها تطبيق حاضر، وكيفية استخدامها وحمايتها. قد تختلف بعض الممارسات حسب طريقة استخدامك للتطبيق والميزات التي تستعملها.</p></div>
  <article className="privacy-section-card">
   <span className="privacy-icon"><Share2 size={25}/></span><h2>مشاركة البيانات</h2><h3>لا نبيع بياناتك ولا نستخدمها للإعلانات</h3><p>لا يبيع حاضر بيانات المستخدمين ولا يشاركها مع جهات خارجية لأغراض إعلانية. نستعين بمزوّدي خدمات تقنية لتشغيل التطبيق، وقد تتم معالجة البيانات الضرورية لديهم، مثل الاستضافة وقاعدة البيانات وتسجيل الدخول.</p><p className="privacy-note">قد يشمل ذلك خدمات Supabase وVercel، وخدمة Google عند اختيار تسجيل الدخول باستخدام Google.</p>
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
