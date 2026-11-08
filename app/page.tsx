"use client";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";
import { formatEventDate } from "../features/events/events.formatters";
import AdvertiserWorkspace from "../features/advertiser/AdvertiserWorkspace";
import { EventsWorkspace } from "../features/events/components/EventsWorkspace";
import { TicketWorkspace } from "../features/customer-account/components/TicketWorkspace";
import { NotificationsWorkspace } from "../features/customer-account/components/NotificationsWorkspace";
import { useGatekeeper } from "../features/gatekeeper/useGatekeeper";
import { GatekeeperWorkspace } from "../features/gatekeeper/components/GatekeeperWorkspace";
import { Bell, CheckCircle2, House, Sparkles, Ticket, UserRound, ChevronLeft, ScanLine, ShieldCheck, ClipboardList } from "lucide-react";

type Tab="home"|"tickets"|"notifications"|"profile";
export default function Home(){
 const [activeTab,setActiveTab]=useState<Tab>("home"),[darkMode,setDarkMode]=useState(false),[loginEmail,setLoginEmail]=useState("");
 const [eventResetKey,setEventResetKey]=useState(0),[isEventDetailOpen,setIsEventDetailOpen]=useState(false);
 const [fullName,setFullName]=useState(""),[email,setEmail]=useState(""),[phone,setPhone]=useState(""),[avatarUrl,setAvatarUrl]=useState(""),[profileEditing,setProfileEditing]=useState(false),[saved,setSaved]=useState(false),[profileSaving,setProfileSaving]=useState(false);
 const [authUser,setAuthUser]=useState<{id:string;email?:string;user_metadata?:Record<string,unknown>}|null>(null),[userRole,setUserRole]=useState("customer"),[authMessage,setAuthMessage]=useState(""),[activeWorkspace,setActiveWorkspace]=useState<"customer"|"organizer"|"gatekeeper"|"advertiser"|"admin"|"owner"|null>(null);
 const [isGatekeeperPage,setIsGatekeeperPage]=useState(false);
 const [showWelcome,setShowWelcome]=useState(false),[welcomeGreeting,setWelcomeGreeting]=useState("أهلاً بيك في حاضر");
 const [assignedEvent,setAssignedEvent]=useState<any|null>(null);
 const [myTickets,setMyTickets]=useState<any[]>([]),[myNotifications,setMyNotifications]=useState<any[]>([]),[accountDataLoading,setAccountDataLoading]=useState(false),[accountDataError,setAccountDataError]=useState("");
 const [notificationFilter,setNotificationFilter]=useState<"all"|"unread"|"read">("all");
 const [ticketFilter,setTicketFilter]=useState<"new"|"used">("new");
 const [expandedTicketId,setExpandedTicketId]=useState<string|null>(null);
  useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const tab=params.get("tab");
  if(tab==="tickets"||tab==="notifications"||tab==="profile")setActiveTab(tab);
  if(params.get("workspace")==="gatekeeper"){setActiveWorkspace("gatekeeper");setIsGatekeeperPage(true);}
 },[]);
 useEffect(()=>{
  const supabase=getSupabaseBrowserClient();if(!supabase||!authUser)return;
  let alive=true;let firstLoad=true;let requestSequence=0;setAccountDataLoading(true);setAccountDataError("");
  const loadAccountData=async()=>{
   const requestId=++requestSequence;
   const [ticketsResult,notificationsResult]=await Promise.all([
    supabase.from("tickets").select("id,booking_item_id,ticket_code,status,issued_at,events(title,starts_at,venue,cover_image_url),ticket_types(name),bookings!inner(booking_number,user_id),booking_items(quantity)").eq("bookings.user_id",authUser.id).order("issued_at",{ascending:false}),
    supabase.from("notifications").select("id,title,message,type,is_read,created_at,booking_id").eq("user_id",authUser.id).order("created_at",{ascending:false}).limit(100)
   ]);
   if(!alive||requestId!==requestSequence)return;
   const failure=ticketsResult.error||notificationsResult.error;
   if(failure)setAccountDataError(failure.message||"تعذر تحميل بيانات الحساب.");
   else{setMyTickets(ticketsResult.data||[]);setMyNotifications(notificationsResult.data||[]);setAccountDataError("");}
   if(firstLoad){setAccountDataLoading(false);firstLoad=false;}
  };
  void loadAccountData();
  const channel=supabase.channel("customer-live-"+authUser.id)
   .on("postgres_changes",{event:"*",schema:"public",table:"tickets"},()=>{void loadAccountData();})
   .on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:"user_id=eq."+authUser.id},()=>{void loadAccountData();})
   .on("postgres_changes",{event:"UPDATE",schema:"public",table:"bookings",filter:"user_id=eq."+authUser.id},()=>{void loadAccountData();})
   .subscribe((status)=>{if(status==="SUBSCRIBED")void loadAccountData();});
  return()=>{alive=false;requestSequence++;void supabase.removeChannel(channel);};
 },[authUser]);
 useEffect(()=>{const saved=window.localStorage.getItem("haddir-theme");const prefersDark=window.matchMedia?.("(prefers-color-scheme: dark)").matches;setDarkMode(saved?saved==="dark":!!prefersDark);},[]);
 useEffect(()=>{document.documentElement.dataset.theme=darkMode?"dark":"light";document.documentElement.style.colorScheme=darkMode?"dark":"light";window.localStorage.setItem("haddir-theme",darkMode?"dark":"light");},[darkMode]);
 useEffect(()=>{const hour=Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Khartoum",hour:"2-digit",hourCycle:"h23"}).format(new Date()));setWelcomeGreeting(hour>=5&&hour<11?"صباح الخير":hour>=11&&hour<17?"نهارك سعيد":hour>=17&&hour<23?"مساء الخير":"ليلة سعيدة");const key="haddir-welcome-seen";if(!sessionStorage.getItem(key)){setShowWelcome(true);sessionStorage.setItem(key,"1");const timer=window.setTimeout(()=>setShowWelcome(false),3200);return()=>window.clearTimeout(timer);}},[]);
 useEffect(()=>{const supabase=getSupabaseBrowserClient();if(!supabase){setAuthMessage("تسجيل الدخول يحتاج إعداد مفاتيح Supabase في بيئة الموقع.");return;}let alive=true;const load=async(user:{id:string;email?:string;user_metadata?:Record<string,unknown>}|null)=>{if(!alive)return;setAuthUser(user as typeof authUser);if(user){const {data}=await supabase.from("profiles").select("role,full_name,phone").eq("id",user.id).maybeSingle();if(!alive)return;setUserRole(data?.role||"customer");const {data:assignmentRows}=await supabase.from("event_role_assignments").select("event_id,assignment_role,events(id,title,venue,city,starts_at,status)").eq("user_id",user.id).in("assignment_role",["gatekeeper","organizer","advertiser"]).limit(1);if(!alive)return;setAssignedEvent(assignmentRows?.[0]||null);const metadataName=String(user.user_metadata?.full_name||user.user_metadata?.name||"");const metadataAvatar=String(user.user_metadata?.avatar_url||user.user_metadata?.picture||"");setFullName(String(data?.full_name||metadataName||""));setPhone(String(data?.phone||""));setEmail(user.email||"");setAvatarUrl(metadataAvatar);setProfileEditing(false);setSaved(false);}else{setUserRole("customer");setAssignedEvent(null);setGatekeeperResult(null);setGatekeeperCode("");setFullName("");setEmail("");setPhone("");setAvatarUrl("");setProfileEditing(false);setSaved(false);setActiveWorkspace(null);}};supabase.auth.getSession().then(({data})=>load(data.session?.user??null));const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{void load(session?.user??null);});return()=>{alive=false;subscription.unsubscribe();};},[]);
 const gatekeeper = useGatekeeper({ authUser, assignedEvent, userRole, isGatekeeperPage, activeWorkspace });
 const {
  gatekeeperCode, setGatekeeperCode, gatekeeperResult, setGatekeeperResult,
  gatekeeperLoading, gatekeeperOnline, manualEntryOpen, setManualEntryOpen,
  gatekeeperCounts, gatekeeperHistory: gatekeeperManualHistory, gatekeeperHistoryLoading,
  scannerOpen, setScannerOpen, videoRef, runGatekeeperAction, openScanner, openManualEntry,
 } = gatekeeper;
 const signInWithGoogle=async()=>{const supabase=getSupabaseBrowserClient();if(!supabase){setAuthMessage("إعدادات تسجيل الدخول غير مكتملة على الموقع.");return;}const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin}});if(error)setAuthMessage(error.message);};
 const signInWithEmail=async()=>{const supabase=getSupabaseBrowserClient();if(!supabase||!loginEmail.trim()){setAuthMessage("أدخل بريدك الإلكتروني أولاً.");return;}const {error}=await supabase.auth.signInWithOtp({email:loginEmail.trim(),options:{emailRedirectTo:window.location.origin}});setAuthMessage(error?error.message:"أرسلنا رابط تسجيل الدخول إلى بريدك الإلكتروني. افتح الرسالة للمتابعة.");};
 const saveProfile=async()=>{if(!authUser){setAuthMessage("سجّل الدخول أولاً لحفظ بياناتك.");return;}const normalizedPhone=phone.replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\s+/g,"");if(!/^0\d{9}$/.test(normalizedPhone)){setAuthMessage("رقم الهاتف لازم يكون 10 خانات بالضبط ويبدأ بصفر، مثال: 09XXXXXXXX.");return;}const supabase=getSupabaseBrowserClient();if(!supabase){setAuthMessage("تعذر الاتصال بقاعدة البيانات حالياً.");return;}setProfileSaving(true);setSaved(false);setAuthMessage("");const {data,error}=await supabase.from("profiles").update({phone:normalizedPhone}).eq("id",authUser.id).select("phone").single();setProfileSaving(false);if(error){setAuthMessage("ما قدرنا نحفظ رقمك. تأكد من الاتصال وحاول مرة تانية.");return;}setPhone(data.phone||normalizedPhone);setProfileEditing(false);setSaved(true);};
 const signOut=async()=>{if(!window.confirm("هل تريد تسجيل الخروج من حسابك؟ ستعود إلى شاشة تسجيل الدخول."))return;const supabase=getSupabaseBrowserClient();if(supabase){const {error}=await supabase.auth.signOut();if(error){setAuthMessage("تعذر تسجيل الخروج حالياً. حاول مرة أخرى.");return;}}setAuthMessage("تم تسجيل الخروج بنجاح. يمكنك تسجيل الدخول مرة أخرى في أي وقت.");};

 const markNotificationRead=async(notification:any,isRead=true)=>{
  if(!authUser)return;
  const supabase=getSupabaseBrowserClient();if(!supabase)return;
  const {error}=await supabase.from("notifications").update({is_read:isRead}).eq("id",notification.id).eq("user_id",authUser.id);
  if(error){setAccountDataError("تعذر تحديث حالة الإشعار. "+error.message);return;}
  setMyNotifications(rows=>rows.map(row=>row.id===notification.id?{...row,is_read:isRead}:row));
 };
 const markAllNotificationsRead=async()=>{
  if(!authUser)return;
  const supabase=getSupabaseBrowserClient();if(!supabase)return;
  const unreadIds=myNotifications.filter(n=>!n.is_read).map(n=>n.id);
  if(!unreadIds.length)return;
  const {error}=await supabase.from("notifications").update({is_read:true}).in("id",unreadIds).eq("user_id",authUser.id);
  if(error){setAccountDataError("تعذر تعليم الإشعارات كمقروءة. "+error.message);return;}
  setMyNotifications(rows=>rows.map(row=>({...row,is_read:true})));
 };
 const openNotification=async(notification:any)=>{
  if(!notification.is_read)await markNotificationRead(notification,true);
  if(notification.type==="ticket_approved"||String(notification.type||"").startsWith("event_reminder_"))go("tickets");
 };
 const unreadNotificationCount=myNotifications.filter(n=>!n.is_read).length;
 const filteredNotifications=myNotifications.filter(n=>notificationFilter==="all"||(notificationFilter==="unread"?!n.is_read:n.is_read));
 const go=(tab:Tab)=>{
  setEventResetKey(value=>value+1);setActiveTab(tab);
  const url=new URL(window.location.href);
  if(tab==="home")url.searchParams.delete("tab");else url.searchParams.set("tab",tab);
  url.searchParams.delete("workspace");setIsGatekeeperPage(false);setActiveWorkspace(null);
  window.history.replaceState({}, "", url.pathname+url.search+url.hash);
  window.scrollTo({top:0,behavior:"smooth"});
 }; const downloadTicket=async(ticket:any)=>{try{const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext("2d");if(!ctx)return;await document.fonts.ready;ctx.fillStyle="#f7f1fb";ctx.fillRect(0,0,1080,1350);ctx.fillStyle="#fff";ctx.fillRect(48,48,984,1254);ctx.strokeStyle="#e7d9f1";ctx.lineWidth=3;ctx.strokeRect(48,48,984,1254);ctx.direction="rtl";ctx.textAlign="right";const right=950;ctx.fillStyle="#5b2e82";ctx.font="bold 48px Alexandria,Arial";ctx.fillText("حاضر  HADDIR",right,135);ctx.fillStyle="#8b7897";ctx.font="26px Alexandria,Arial";ctx.fillText("تذكرة دخول إلكترونية",right,190);ctx.strokeStyle="#dfd1e9";ctx.setLineDash([10,9]);ctx.beginPath();ctx.moveTo(100,230);ctx.lineTo(980,230);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="#8b7897";ctx.font="26px Alexandria,Arial";ctx.fillText("الفعالية",right,300);ctx.fillStyle="#30213b";ctx.font="bold 44px Alexandria,Arial";const eventTitle=String(ticket.events?.title||"فعالية");ctx.fillText(eventTitle.length>32?eventTitle.slice(0,32)+"…":eventTitle,right,365);ctx.fillStyle="#8b7897";ctx.font="24px Alexandria,Arial";ctx.fillText("نوع التذكرة",right,455);ctx.fillText("رقم الحجز",520,455);ctx.fillStyle="#3d3047";ctx.font="bold 27px Alexandria,Arial";ctx.fillText(String(ticket.ticket_types?.name||"تذكرة"),right,500);ctx.fillText(String(ticket.bookings?.booking_number||"—"),520,500);ctx.fillStyle="#8b7897";ctx.font="24px Alexandria,Arial";ctx.fillText("الموقع",right,575);ctx.fillText("التاريخ",520,575);ctx.fillStyle="#3d3047";ctx.font="bold 25px Alexandria,Arial";ctx.fillText(String(ticket.events?.venue||"—"),right,620);ctx.fillText(ticket.events?.starts_at?formatEventDate(ticket.events.starts_at):"—",520,620);ctx.strokeStyle="#e5d9ed";ctx.setLineDash([10,9]);ctx.beginPath();ctx.moveTo(100,675);ctx.lineTo(980,675);ctx.stroke();ctx.setLineDash([]);const qr=document.querySelector('[data-ticket-id="'+String(ticket.id)+'"] .haddir-ticket-qr svg');if(!qr)throw new Error("QR unavailable");const svg=new XMLSerializer().serializeToString(qr);const img=new Image();const loaded=new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error("QR image failed"));});img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);await loaded;ctx.drawImage(img,360,700,360,360);ctx.fillStyle="#8e8297";ctx.font="23px Alexandria,Arial";ctx.textAlign="center";ctx.fillText("امسح الرمز للتحقق من التذكرة",540,1100);ctx.fillStyle="#5c2e82";ctx.font="bold 48px Arial";ctx.fillText(String(ticket.ticket_code||""),540,1170);ctx.fillStyle="#f6f0fa";ctx.fillRect(48,1200,984,102);ctx.fillStyle="#76558d";ctx.font="bold 23px Alexandria,Arial";ctx.fillText("احتفظ بالتذكرة وأبرزها عند الدخول",540,1262);const link=document.createElement("a");link.download="haddir-ticket-"+String(ticket.ticket_code||ticket.id)+".png";link.href=canvas.toDataURL("image/png");link.click();}catch(error){console.error("Ticket image export failed",error);alert("تعذر حفظ التذكرة كصورة. حاول مرة أخرى.");}};

 return <main dir="rtl" lang="ar" className={"app-shell"+(darkMode?" theme-dark":"")}>
 <>
 {!isEventDetailOpen&&(isGatekeeperPage?<header className="screen-topbar gatekeeper-page-topbar"><button type="button" className="btn btn-outline" onClick={()=>{setIsGatekeeperPage(false);setActiveWorkspace(null);const url=new URL(window.location.href);url.searchParams.delete("workspace");window.location.assign(url.pathname+url.search+url.hash);}}>العودة للملف الشخصي</button><strong>مسح التذاكر</strong><span className="screen-icon"><ScanLine/></span></header>:activeTab==="home"?<header className="topbar"><div className="container header-inner"><button className="brand brand-button" onClick={()=>go("home")}><span className="brand-mark">ح</span> حاضر</button><div className="desktop-greeting">من السودان، لكل لحظة تستاهل الحضور.</div><button className="header-icon theme-toggle" type="button" aria-label={darkMode?"تفعيل الوضع النهاري":"تفعيل الوضع الليلي"} aria-pressed={darkMode} onClick={()=>setDarkMode(v=>!v)}>{<span className="theme-toggle-track" aria-hidden="true"><span className="theme-toggle-knob">{darkMode?"☾":"☀"}</span></span>}</button></div></header>:<header className="screen-topbar"><span className="screen-topbar-spacer" aria-hidden="true"/><strong>{({tickets:"تذاكري",notifications:"الإشعارات",profile:"الملف الشخصي"} as Record<string,string>)[activeTab]}</strong><span className="screen-icon">{activeTab==="tickets"?<Ticket/>:activeTab==="notifications"?<Bell/>:<UserRound/>}</span></header>)}
 <div className="app-content">
 {!isGatekeeperPage&&activeTab==="home"&&showWelcome&&<div className="welcome-overlay" role="status" aria-live="polite"><div className="welcome-motion"><span className="welcome-spark"><Sparkles size={22}/></span><span className="welcome-brand-mark">ح</span><strong>{welcomeGreeting}</strong><p>أهلاً بيك في حاضر</p><span className="welcome-orbit" aria-hidden="true">✦</span></div></div>}
 <EventsWorkspace
  showHome={!isGatekeeperPage&&activeTab==="home"}
  resetKey={eventResetKey}
  authUser={authUser}
  onEventOpenChange={setIsEventDetailOpen}
  onRequireLogin={()=>{setAuthMessage("سجّل الدخول أولاً عشان نكمل حجزك. الفعاليات متاحة للتصفح بدون حساب.");setActiveTab("profile");}}
  onBookingSuccess={()=>setActiveTab("notifications")}
  onGoNotifications={()=>setActiveTab("notifications")}
 />
 {!isGatekeeperPage&&activeTab==="tickets"&&<TicketWorkspace
  loading={accountDataLoading}
  error={accountDataError}
  tickets={myTickets}
  filter={ticketFilter}
  expandedTicketId={expandedTicketId}
  onFilterChange={(filter)=>{setTicketFilter(filter);setExpandedTicketId(null);}}
  onToggleTicket={(ticketId)=>setExpandedTicketId(current=>current===ticketId?null:ticketId)}
  onDownloadTicket={(ticket)=>void downloadTicket(ticket)}
  formatEventDate={formatEventDate}
 />}
 {!isGatekeeperPage&&activeTab==="notifications"&&<NotificationsWorkspace
  loading={accountDataLoading}
  error={accountDataError}
  notifications={myNotifications}
  filteredNotifications={filteredNotifications}
  filter={notificationFilter}
  unreadCount={unreadNotificationCount}
  onFilterChange={setNotificationFilter}
  onMarkAllRead={()=>void markAllNotificationsRead()}
  onOpenNotification={(notification)=>void openNotification(notification)}
  onToggleRead={(notification,isRead)=>void markNotificationRead(notification,isRead)}
 />}
 {!isGatekeeperPage&&activeTab==="profile"&&<section className="screen container profile-screen">
   <div className="profile-card profile-account-card">
    <div className="profile-account-head">
     <div className="profile-avatar profile-avatar-large">{avatarUrl?<img src={avatarUrl} alt="صورة المستخدم"/>:<UserRound size={34}/>}</div>
     <div className="profile-account-identity"><strong>{authUser?(fullName.trim()||"مستخدم حاضر"):(fullName.trim()||"ضيف حاضر")}</strong><p>{authUser?.email||email||"لم تسجل الدخول بعد"}</p><small className="account-type">{authUser?(({owner:"مالك المنصة",admin:"مشرف إداري",supervisor:"موظف حاضر",organizer:"بواب",gatekeeper:"بواب",advertiser:"معلن"} as Record<string,string>)[userRole]||"عميل"):"زائر"}</small></div>
    </div>
    {authUser&&<div className="profile-info-list"><div><span>الاسم</span><strong>{fullName.trim()||"غير محدد"}</strong></div><div><span>البريد الإلكتروني</span><strong dir="ltr">{authUser.email||email||"—"}</strong></div><div><span>رقم الهاتف</span><strong dir="ltr">{phone||"لم تتم إضافته بعد"}</strong></div></div>}
    {authUser&&!profileEditing&&<button className="btn btn-primary profile-edit-button" type="button" onClick={()=>{setProfileEditing(true);setAuthMessage("");setSaved(false);}}>تعديل البيانات</button>}
    {authUser&&profileEditing&&<form className="profile-form profile-form-unified" onSubmit={e=>{e.preventDefault();void saveProfile();}}><label>رقم الهاتف السوداني<input type="tel" inputMode="numeric" autoComplete="tel-national" value={phone} onChange={e=>{setPhone(e.target.value.replace(/[^0-9٠-٩]/g,"").slice(0,10));setSaved(false);}} placeholder="09XXXXXXXX" maxLength={10} dir="ltr" required/></label><p className="profile-save-note">أدخل 10 أرقام بالضبط، ويبدأ الرقم بصفر. مثال: 09XXXXXXXX</p><div className="profile-edit-actions"><button className="btn btn-primary" type="submit" disabled={profileSaving}>{profileSaving?"جاري الحفظ...":"حفظ الرقم"}</button><button className="btn btn-outline" type="button" onClick={()=>{setProfileEditing(false);setAuthMessage("");}}>إلغاء</button></div></form>}
    {!authUser&&<div className="auth-card" style={{marginTop:18}}><h2>سجّل الدخول إلى حاضر</h2><p>تصفح الفعاليات متاح للجميع. سجّل الدخول لحفظ بياناتك ومتابعة حجوزاتك.</p><label className="checkout-label">البريد الإلكتروني<input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="name@example.com" dir="ltr" required/></label><button className="btn btn-primary pay-button" type="button" onClick={signInWithEmail}>إرسال رابط الدخول</button><div className="auth-divider">أو</div><button className="btn btn-outline pay-button" type="button" onClick={signInWithGoogle}>المتابعة باستخدام Google</button></div>}
    {saved&&<p className="save-confirm"><CheckCircle2 size={16}/> تم حفظ رقم الهاتف بنجاح.</p>}{authMessage&&<p className="profile-save-error" role="alert">{authMessage}</p>}
   </div>
{authUser&&<section className="role-workspace-section" aria-label="واجهات العمل">
  {(userRole==="owner"||userRole==="admin")&&<button type="button" className="role-workspace-button" onClick={()=>window.location.assign("/admin")}><span className="role-workspace-icon"><ShieldCheck size={21}/></span><span><strong>لوحة الإدارة</strong><small>إدارة المنصة والموظفين والفعاليات والحجوزات</small></span><ChevronLeft size={18}/></button>}
  {userRole==="supervisor"&&<button type="button" className="role-workspace-button" onClick={()=>window.location.assign("/admin")}><span className="role-workspace-icon"><ClipboardList size={21}/></span><span><strong>لوحة الإشراف</strong><small>مراجعة الحجوزات وإثباتات الدفع واتخاذ قرار القبول أو الرفض</small></span><ChevronLeft size={18}/></button>}
   {(userRole==="gatekeeper"||userRole==="organizer")&&<button type="button" className="role-workspace-button" onClick={()=>window.location.assign("/?tab=profile&workspace=gatekeeper")}><span className="role-workspace-icon"><ScanLine size={21}/></span><span><strong>مسح التذاكر</strong><small>فحص تذاكر الفعالية وتأكيد دخول الحضور</small></span><ChevronLeft size={18}/></button>}
  {userRole==="advertiser"&&<AdvertiserWorkspace authUser={authUser} userRole={userRole}/>}

 </section>}
 {authUser&&<button className="btn profile-logout-button role-logout-button" type="button" onClick={signOut}>تسجيل الخروج</button>}
 <div className="profile-settings-panel"><div><strong>إعدادات العرض</strong><p>غيّر مظهر التطبيق في كل الصفحات.</p></div><button className="btn btn-outline" type="button" onClick={()=>setDarkMode(v=>!v)}>{darkMode?"☀ الوضع النهاري":"☾ الوضع الليلي"}</button></div>
 {authMessage&&<p className="save-confirm">{authMessage}</p>}
 </section>}
  {isGatekeeperPage&&<GatekeeperWorkspace
   userRole={userRole}
   assignedEvent={assignedEvent}
   online={gatekeeperOnline}
   counts={gatekeeperCounts}
   loading={gatekeeperLoading}
   code={gatekeeperCode}
   result={gatekeeperResult}
   manualEntryOpen={manualEntryOpen}
   scannerOpen={scannerOpen}
   history={gatekeeperManualHistory}
   historyLoading={gatekeeperHistoryLoading}
   videoRef={videoRef}
   onOpenScanner={openScanner}
   onOpenManual={openManualEntry}
   onCodeChange={setGatekeeperCode}
   onManualSubmit={()=>{setScannerOpen(false);setManualEntryOpen(false);void runGatekeeperAction(true,gatekeeperCode,"manual");}}
   onClose={()=>{const url=new URL(window.location.href);url.searchParams.delete("workspace");url.searchParams.set("tab","profile");window.location.assign(url.pathname+url.search+url.hash);}}
  />}
 </div>
 {!isGatekeeperPage&&!isEventDetailOpen&&<nav className="bottom-nav" aria-label="التنقل الرئيسي"><span className="bottom-nav-active-pill" aria-hidden="true" style={{transform:`translateX(-${["home","tickets","notifications","profile"].indexOf(activeTab)*100}%)`}}/><button className={activeTab==="home"?"selected":""} onClick={()=>go("home")}><House size={21}/><span>الرئيسية</span></button><button className={activeTab==="tickets"?"selected":""} onClick={()=>go("tickets")}><Ticket size={21}/><span>تذاكري</span></button><button className={activeTab==="notifications"?"selected":""} onClick={()=>go("notifications")}><Bell size={21}/><span>الإشعارات</span></button><button className={activeTab==="profile"?"selected":""} onClick={()=>go("profile")}><UserRound size={21}/><span>حسابي</span></button></nav>}
 </>
 
 </main>;
}