"use client";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/browser";
import { THEME_STORAGE_KEY } from "../lib/constants";
import { normalizeSudanesePhone, isValidSudanesePhone } from "../lib/utils/phone";
import { AppShell } from "../components/layout/AppShell";
import { BottomNav } from "../components/layout/BottomNav";
import { PageHeader } from "../components/layout/PageHeader";
import { formatEventDate } from "../features/events/events.formatters";
import { ProfileWorkspace } from "../features/customer-account/components/ProfileWorkspace";
import { EventsWorkspace } from "../features/events/components/EventsWorkspace";
import { TicketWorkspace } from "../features/customer-account/components/TicketWorkspace";
import { NotificationsWorkspace } from "../features/customer-account/components/NotificationsWorkspace";
import { useCustomerAccount } from "../features/customer-account/hooks/useCustomerAccount";
import { requestCustomerAccountDeletion } from "../features/customer-account/services/customer-account.service";
import { useAuth } from "../features/auth/hooks/useAuth";
import { signInWithGoogle as startGoogleSignIn, updateCustomerPhone } from "../features/auth/services/auth.service";
import { useGatekeeper } from "../features/gatekeeper/hooks/useGatekeeper";
import { GatekeeperWorkspace } from "../features/gatekeeper/components/GatekeeperWorkspace";
import { HaddirDialog } from "../components/ui/HaddirDialog";
import { Bell, Ticket, UserRound, ChevronLeft, ScanLine, ShieldCheck, Sun, Moon } from "lucide-react";

type Tab="home"|"tickets"|"notifications"|"profile";
export default function Home(){
 const [activeTab,setActiveTab]=useState<Tab>("home"),[darkMode,setDarkMode]=useState(false),[showPrivacySecurity,setShowPrivacySecurity]=useState(false),[deletingAccount,setDeletingAccount]=useState(false);
 const [accountDialog,setAccountDialog]=useState<"logout"|"delete-email"|"delete-final"|null>(null),[deleteEmailInput,setDeleteEmailInput]=useState(""),[uiNotice,setUiNotice]=useState("");
 const [bookingGate,setBookingGate]=useState<"login"|"phone"|null>(null);
 const [eventResetKey,setEventResetKey]=useState(0),[isEventDetailOpen,setIsEventDetailOpen]=useState(false);
 const [profileSaving,setProfileSaving]=useState(false);
 const [activeWorkspace,setActiveWorkspace]=useState<"customer"|"organizer"|"gatekeeper"|"advertiser"|"admin"|"owner"|null>(null);
 const [isGatekeeperPage,setIsGatekeeperPage]=useState(false);
 const [showWelcome,setShowWelcome]=useState(true),[welcomeFading,setWelcomeFading]=useState(false),[welcomeGreeting,setWelcomeGreeting]=useState("أهلاً بيك في حاضر");
 const { authUser, userRole, assignedEvent, fullName, email, phone, setPhone, avatarUrl, profileEditing, setProfileEditing, saved, setSaved, authMessage, setAuthMessage } = useAuth();
 const { myTickets, myNotifications, accountDataLoading, accountDataError, markNotificationRead: markCustomerNotificationReadAction, markAllNotificationsRead: markAllCustomerNotificationsReadAction } = useCustomerAccount(authUser?.id ?? null);
 const [notificationFilter,setNotificationFilter]=useState<"unread"|"read">("unread");
 const [ticketFilter,setTicketFilter]=useState<"new"|"used">("new");
 const [expandedTicketId,setExpandedTicketId]=useState<string|null>(null);
  useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const tab=params.get("tab");
  if(tab==="tickets"||tab==="notifications"||tab==="profile")setActiveTab(tab);
  if(params.get("workspace")==="gatekeeper"){setActiveWorkspace("gatekeeper");setIsGatekeeperPage(true);}
 },[]);
 useEffect(()=>{const saved=window.localStorage.getItem(THEME_STORAGE_KEY);const prefersDark=window.matchMedia?.("(prefers-color-scheme: dark)").matches;setDarkMode(saved?saved==="dark":!!prefersDark);},[]);
 useEffect(()=>{document.documentElement.dataset.theme=darkMode?"dark":"light";document.documentElement.style.colorScheme=darkMode?"dark":"light";window.localStorage.setItem(THEME_STORAGE_KEY,darkMode?"dark":"light");const themeMeta=document.querySelector('meta[name="theme-color"]');themeMeta?.setAttribute("content",darkMode?"#1D135D":"#F6F4FF");},[darkMode]);
 useEffect(()=>{const hour=Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Khartoum",hour:"2-digit",hourCycle:"h23"}).format(new Date()));setWelcomeGreeting(hour>=5&&hour<11?"صباح الخير":hour>=11&&hour<17?"نهارك سعيد":hour>=17&&hour<23?"مساء الخير":"ليلة سعيدة");let seen=false;try{seen=sessionStorage.getItem("haddir_splash")==="1";}catch(e){}if(seen){setShowWelcome(false);return;}try{sessionStorage.setItem("haddir_splash","1");}catch(e){}let removeTimer: number|undefined;const fadeTimer=window.setTimeout(()=>{setWelcomeFading(true);removeTimer=window.setTimeout(()=>setShowWelcome(false),450);},2600);return()=>{window.clearTimeout(fadeTimer);if(removeTimer!==undefined)window.clearTimeout(removeTimer);};},[]);
 const gatekeeper = useGatekeeper({ authUser, assignedEvent, userRole, isGatekeeperPage, activeWorkspace });
 const {
  gatekeeperCode, setGatekeeperCode, gatekeeperResult, setGatekeeperResult,
  gatekeeperLoading, gatekeeperOnline, manualEntryOpen, setManualEntryOpen,
  gatekeeperCounts, gatekeeperHistory: gatekeeperManualHistory, gatekeeperHistoryLoading,
  scannerOpen, setScannerOpen, videoRef, runGatekeeperAction, openScanner, openManualEntry, acknowledgeGatekeeperResult,
 } = gatekeeper;
 useEffect(()=>{if(!authUser){setGatekeeperResult(null);setGatekeeperCode("");}},[authUser]);
 const signInWithGoogle=async()=>{const error=await startGoogleSignIn();if(error)setAuthMessage(error);};
 const saveProfile=async()=>{if(!authUser){setAuthMessage("سجّل الدخول أولاً لحفظ بياناتك.");return;}const normalizedPhone=normalizeSudanesePhone(phone);if(!isValidSudanesePhone(normalizedPhone)){setAuthMessage("رقم الهاتف لازم يكون 10 خانات بالضبط ويبدأ بصفر، مثال: 09XXXXXXXX.");return;}setProfileSaving(true);setSaved(false);setAuthMessage("");const result=await updateCustomerPhone(authUser.id,normalizedPhone);setProfileSaving(false);if(result.error){setAuthMessage(result.error);return;}setPhone(result.phone||normalizedPhone);setProfileEditing(false);setSaved(true);};
 const deleteAccount=()=>{
  if(!authUser?.email){setAuthMessage("سجّل الدخول أولاً عشان تقدر تحذف حسابك.");return;}
  setDeleteEmailInput("");
  setAccountDialog("delete-email");
 };
 const executeDeleteAccount=async()=>{
  const confirmedEmail=deleteEmailInput.trim();
  if(!authUser?.email)return;
  if(confirmedEmail.toLowerCase()!==authUser.email.toLowerCase()){setAccountDialog(null);setAuthMessage("البريد الإلكتروني غير مطابق. لم يتم حذف أي بيانات.");return;}
  setAccountDialog(null);setDeletingAccount(true);setAuthMessage("");
  const deletion=await requestCustomerAccountDeletion(confirmedEmail);
  setDeletingAccount(false);
  if(deletion.error){setAuthMessage(deletion.error);return;}
  const supabase=getSupabaseBrowserClient();
  if(supabase)await supabase.auth.signOut();
  window.location.assign("/?tab=profile");
 };
 const signOut=()=>setAccountDialog("logout");
 const confirmSignOut=async()=>{
  setAccountDialog(null);
  const supabase=getSupabaseBrowserClient();if(supabase){const {error}=await supabase.auth.signOut();if(error){setAuthMessage("تعذر تسجيل الخروج حالياً. حاول مرة أخرى.");return;}}
  setAuthMessage("تم تسجيل الخروج بنجاح. يمكنك تسجيل الدخول مرة أخرى في أي وقت.");
 };

 const markNotificationRead=async(notification:any)=>{
  const result=await markCustomerNotificationReadAction(notification.id);
  if(!result.error)setNotificationFilter("read");
 };
 const markAllNotificationsRead=async()=>{
  const result=await markAllCustomerNotificationsReadAction();
  if(!result.error)setNotificationFilter("read");
 };
 const openNotification=async(notification:any)=>{
  if(!notification.is_read)await markNotificationRead(notification);
  if(notification.type==="ticket_approved"||String(notification.type||"").startsWith("event_reminder_"))go("tickets");
 };
 const unreadNotificationCount=myNotifications.filter(n=>!n.is_read).length;
 const filteredNotifications=myNotifications.filter(n=>notificationFilter==="unread"?!n.is_read:n.is_read);
 const go=(tab:Tab)=>{
  setShowPrivacySecurity(false);setEventResetKey(value=>value+1);setActiveTab(tab);
  const url=new URL(window.location.href);
  if(tab==="home")url.searchParams.delete("tab");else url.searchParams.set("tab",tab);
  url.searchParams.delete("workspace");setIsGatekeeperPage(false);setActiveWorkspace(null);
  window.history.replaceState({}, "", url.pathname+url.search+url.hash);
  window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
 }; const downloadTicket=async(ticket:any)=>{try{const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext("2d");if(!ctx)return;await document.fonts.ready;ctx.fillStyle="#eef6f9";ctx.fillRect(0,0,1080,1350);ctx.fillStyle="#fff";ctx.fillRect(48,48,984,1254);ctx.strokeStyle="#d8ecf3";ctx.lineWidth=3;ctx.strokeRect(48,48,984,1254);ctx.direction="rtl";ctx.textAlign="right";const right=950;const brandImg=new Image();const brandLoaded=new Promise<void>((resolve,reject)=>{brandImg.onload=()=>resolve();brandImg.onerror=()=>reject(new Error("Haddir logo failed"));});brandImg.src="/ticket.svg";await brandLoaded;ctx.drawImage(brandImg,790,70,160,80);ctx.fillStyle="#52707a";ctx.font="26px 'IBM Plex Sans Arabic',Arial";ctx.fillText("تذكرة دخول إلكترونية",right,190);ctx.strokeStyle="#b9d9e2";ctx.setLineDash([10,9]);ctx.beginPath();ctx.moveTo(100,230);ctx.lineTo(980,230);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="#52707a";ctx.font="26px 'IBM Plex Sans Arabic',Arial";ctx.fillText("الفعالية",right,300);ctx.fillStyle="#082028";ctx.font="bold 44px 'IBM Plex Sans Arabic',Arial";const eventTitle=String(ticket.events?.title||"فعالية");ctx.fillText(eventTitle.length>32?eventTitle.slice(0,32)+"…":eventTitle,right,365);ctx.fillStyle="#52707a";ctx.font="24px 'IBM Plex Sans Arabic',Arial";ctx.fillText("نوع التذكرة",right,455);ctx.fillText("رقم الحجز",520,455);ctx.fillStyle="#082028";ctx.font="bold 27px 'IBM Plex Sans Arabic',Arial";ctx.fillText(String(ticket.ticket_types?.name||"تذكرة"),right,500);ctx.fillText(String(ticket.bookings?.booking_number||"—"),520,500);ctx.fillStyle="#52707a";ctx.font="24px 'IBM Plex Sans Arabic',Arial";ctx.fillText("الموقع",right,575);ctx.fillText("التاريخ",520,575);ctx.fillStyle="#082028";ctx.font="bold 25px 'IBM Plex Sans Arabic',Arial";ctx.fillText(String(ticket.events?.venue||"—"),right,620);ctx.fillText(ticket.events?.is_continuous?"مستمر":ticket.events?.starts_at?formatEventDate(ticket.events.starts_at):"—",520,620);ctx.strokeStyle="#d8ecf3";ctx.setLineDash([10,9]);ctx.beginPath();ctx.moveTo(100,675);ctx.lineTo(980,675);ctx.stroke();ctx.setLineDash([]);const qr=document.querySelector('[data-ticket-id="'+String(ticket.id)+'"] .haddir-ticket-qr svg');if(!qr)throw new Error("QR unavailable");const svg=new XMLSerializer().serializeToString(qr);const img=new Image();const loaded=new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error("QR image failed"));});img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);await loaded;ctx.drawImage(img,360,700,360,360);ctx.fillStyle="#52707a";ctx.font="23px 'IBM Plex Sans Arabic',Arial";ctx.textAlign="center";ctx.fillText("امسح الرمز للتحقق من التذكرة",540,1100);ctx.fillStyle="#075985";ctx.font="bold 48px 'IBM Plex Sans Arabic',Arial";ctx.fillText(String(ticket.ticket_code||""),540,1170);ctx.fillStyle="#d8ecf3";ctx.fillRect(48,1200,984,102);ctx.fillStyle="#075985";ctx.font="bold 23px 'IBM Plex Sans Arabic',Arial";ctx.fillText("احتفظ بالتذكرة وأبرزها عند الدخول",540,1262);const link=document.createElement("a");link.download="haddir-ticket-"+String(ticket.ticket_code||ticket.id)+".png";link.href=canvas.toDataURL("image/png");link.click();}catch(error){console.error("Ticket image export failed",error);setUiNotice("تعذر حفظ التذكرة كصورة. حاول مرة أخرى.");}};

 return <AppShell darkMode={darkMode}>
 <>
 {!isEventDetailOpen&&(showPrivacySecurity&&!isGatekeeperPage?<header className="screen-topbar privacy-screen-topbar"><button type="button" className="privacy-back-button" onClick={()=>setShowPrivacySecurity(false)}><ChevronLeft size={18}/> رجوع</button><strong>الخصوصية والأمان</strong><span className="screen-icon"><ShieldCheck/></span></header>:isGatekeeperPage?<header className="screen-topbar gatekeeper-page-topbar"><button type="button" className="btn btn-outline" onClick={()=>{setIsGatekeeperPage(false);setActiveWorkspace(null);const url=new URL(window.location.href);url.searchParams.delete("workspace");window.location.assign(url.pathname+url.search+url.hash);}}>العودة للملف الشخصي</button><strong>مسح التذاكر</strong><span className="screen-icon"><ScanLine/></span></header>:activeTab==="home"?<header className="topbar"><div className="container header-inner"><button className="brand brand-button" onClick={()=>go("home")}><img className="brand-logo" src={darkMode?"/dark.svg?v=20261111-home-logo":"/light.svg?v=20261111-home-logo"} alt="حاضر" /></button><div className="desktop-greeting">من السودان، لكل لحظة تستاهل الحضور.</div><button className="header-icon theme-toggle" type="button" aria-label={darkMode?"تفعيل الوضع النهاري":"تفعيل الوضع الليلي"} aria-pressed={darkMode} title={darkMode?"تفعيل الوضع النهاري":"تفعيل الوضع الليلي"} onClick={()=>setDarkMode(v=>!v)}><span className="theme-toggle-track" aria-hidden="true"><span className="theme-toggle-knob">{darkMode?<Sun size={17} strokeWidth={2.3}/>:<Moon size={16} strokeWidth={2.3}/>}</span></span></button></div></header>:<PageHeader title={({tickets:"تذاكري",notifications:"الإشعارات",profile:"الملف الشخصي"} as Record<string,string>)[activeTab]} icon={activeTab==="tickets"?<Ticket/>:activeTab==="notifications"?<Bell/>:<UserRound/>}/>)}
 <div className="app-content">
 {showWelcome&&<div id="haddir-splash" className={welcomeFading?"out":""} role="img" aria-label="حاضر" onClick={()=>{if(!welcomeFading){setWelcomeFading(true);window.setTimeout(()=>setShowWelcome(false),450);}}}>
  <svg viewBox="30 370 905 230" aria-hidden="true">
    <g className="logo p">
      <path className="line" d="M60 484H905" stroke="#fff" strokeWidth="4" strokeDasharray="12 9" strokeLinecap="round" fill="none"/>
      <rect className="cover" x="40" y="470" width="885" height="28" fill="#5B2EFF"/>
      <g fill="#fff">
        <path className="notch p" style={{animationDelay:".05s, .75s"}} d="M49 480a11 11 0 0 1 22 0zM49 488a11 11 0 0 0 22 0z"/>
        <path className="notch p" style={{animationDelay:".15s, .75s"}} d="M199 480a11 11 0 0 1 22 0zM199 488a11 11 0 0 0 22 0z"/>
        <path className="notch p" style={{animationDelay:".25s, .75s"}} d="M377 480a11 11 0 0 1 22 0zM377 488a11 11 0 0 0 22 0z"/>
        <path className="notch p" style={{animationDelay:".35s, .75s"}} d="M553 480a11 11 0 0 1 22 0zM553 488a11 11 0 0 0 22 0z"/>
        <path className="notch p" style={{animationDelay:".45s, .75s"}} d="M706 480a11 11 0 0 1 22 0zM706 488a11 11 0 0 0 22 0z"/>
        <path className="notch p" style={{animationDelay:".55s, .75s"}} d="M755 480a11 11 0 0 1 22 0zM755 488a11 11 0 0 0 22 0z"/>
        <path className="notch p" style={{animationDelay:".6s, .75s"}} d="M894 480a11 11 0 0 1 22 0zM894 488a11 11 0 0 0 22 0z"/>
      </g>
      <g fill="#fff">
        <path className="hp p hp-one" style={{animationDelay:".5s"}} d="M60 410h48v148H60z"/>
        <path className="hp p hp-two" style={{animationDelay:".6s"}} d="M108 476h47v39h-47z"/>
        <path className="hp p hp-three" style={{animationDelay:".7s"}} d="M155 410h48v148h-48z"/>
        <g className="hx"><g fill="#5B2EFF"><circle cx="60" cy="430" r="7"/><circle cx="108" cy="430" r="7"/><circle cx="155" cy="536" r="7"/><circle cx="203" cy="536" r="7"/></g>
          <path className="march" d="M155 443h48M60 536h48" stroke="#5B2EFF" strokeWidth="3" fill="none"/></g>
        <g className="L p" style={{animationDelay:".75s"}}><path d="M256 410h80l37 148h-50l-27-118-27 118h-51z"/></g>
        <g className="L p tilt-left" style={{animationDelay:".88s"}}><path d="M402 411h70c50 0 81 28 81 73s-31 74-81 74h-70z"/>
          <g className="icon p"><rect x="444" y="435" width="55" height="102" rx="7" fill="#5B2EFF"/>
            <path className="march" d="M444 460h55" stroke="#fff" strokeWidth="3" fill="none"/>
            <circle cx="471" cy="435" r="8" fill="#fff"/><circle cx="471" cy="537" r="8" fill="#fff"/></g></g>
        <g className="L p" style={{animationDelay:"1.01s"}}><path d="M585 420h42c55 0 67 38 67 64s-12 64-67 64h-42z" fill="none" stroke="#fff" strokeWidth="19"/></g>
        <g className="L p tilt-left" style={{animationDelay:"1.14s"}}><rect x="730" y="410" width="20" height="148"/><path className="march" d="M730 443h20" stroke="#5B2EFF" strokeWidth="3"/></g>
        <g className="L p" style={{animationDelay:"1.27s"}}><path d="M792 558V420h53c40 0 52 20 52 42 0 26-17 43-47 46 8 32 25 45 55 41" fill="none" stroke="#fff" strokeWidth="19"/></g>
      </g>
    </g>
  </svg>
</div>}
 <EventsWorkspace
  showHome={!isGatekeeperPage&&activeTab==="home"}
  resetKey={eventResetKey}
  authUser={authUser}
  onEventOpenChange={setIsEventDetailOpen}
  phone={phone}
  onRequireLogin={()=>setBookingGate("login")}
  onRequirePhone={()=>setBookingGate("phone")}
  onBookingSuccess={()=>{}}
  onGoNotifications={()=>go("notifications")}
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
  userId={authUser?.id ?? null}
  loading={accountDataLoading}
  error={accountDataError}
  notifications={myNotifications}
  filteredNotifications={filteredNotifications}
  filter={notificationFilter}
  unreadCount={unreadNotificationCount}
  onFilterChange={setNotificationFilter}
  onMarkAllRead={()=>void markAllNotificationsRead()}
  onOpenNotification={(notification)=>void openNotification(notification)}
  onToggleRead={(notification)=>void markNotificationRead(notification)}
 />}
 {!isGatekeeperPage&&activeTab==="profile"&&<ProfileWorkspace
  authUser={authUser} userRole={userRole} fullName={fullName} email={email}
  phone={phone} setPhone={setPhone} avatarUrl={avatarUrl}
  profileEditing={profileEditing} setProfileEditing={setProfileEditing}
  saved={saved} setSaved={setSaved} authMessage={authMessage} setAuthMessage={setAuthMessage}
  profileSaving={profileSaving} deletingAccount={deletingAccount} darkMode={darkMode}
  setDarkMode={setDarkMode} showPrivacySecurity={showPrivacySecurity}
  setShowPrivacySecurity={setShowPrivacySecurity} saveProfile={()=>void saveProfile()}
  signInWithGoogle={()=>void signInWithGoogle()} deleteAccount={deleteAccount} signOut={signOut}
/>}
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
   onAcknowledgeResult={acknowledgeGatekeeperResult}
   onClose={()=>{const url=new URL(window.location.href);url.searchParams.delete("workspace");url.searchParams.set("tab","profile");window.location.assign(url.pathname+url.search+url.hash);}}
  />}
 </div>
 {uiNotice&&<HaddirDialog open title="تنبيه من حاضر" description={uiNotice} confirmLabel="حسناً" onConfirm={()=>setUiNotice("")} onCancel={()=>setUiNotice("")}/>}
 {accountDialog==="logout"&&<HaddirDialog open title="تسجيل الخروج؟" description="هل تريد تسجيل الخروج من حسابك؟ ستعود إلى شاشة تسجيل الدخول." confirmLabel="تسجيل الخروج" tone="primary" onConfirm={confirmSignOut} onCancel={()=>setAccountDialog(null)}/>}
 {accountDialog==="delete-email"&&<HaddirDialog open title="تأكيد هوية الحساب" description="اكتب البريد الإلكتروني المرتبط بحسابك للمتابعة في طلب حذف الحساب." confirmLabel="متابعة" onConfirm={()=>{if(!deleteEmailInput.trim()){setAuthMessage("اكتب البريد الإلكتروني أولاً.");return;}if(deleteEmailInput.trim().toLowerCase()!==authUser?.email?.toLowerCase()){setAccountDialog(null);setAuthMessage("البريد الإلكتروني غير مطابق. لم يتم حذف أي بيانات.");return;}setAccountDialog("delete-final");}} onCancel={()=>setAccountDialog(null)}><input className="haddir-dialog-input" type="email" value={deleteEmailInput} onChange={event=>setDeleteEmailInput(event.target.value)} placeholder="البريد الإلكتروني" autoComplete="email"/></HaddirDialog>}
 {accountDialog==="delete-final"&&<HaddirDialog open title="حذف الحساب نهائياً؟" description="سيتم حذف الحساب وإيصالات التحويل والبيانات الشخصية. ستبقى سجلات المعاملات اللازمة محفوظة بعد إزالة بيانات تعريفك. لن يسمح النظام بالحذف إذا كانت لديك تذكرة مؤكدة لفعالية قادمة." confirmLabel="حذف الحساب نهائياً" tone="danger" busy={deletingAccount} onConfirm={executeDeleteAccount} onCancel={()=>setAccountDialog(null)}/>}
 {bookingGate&&<div className="booking-gate-backdrop" role="presentation"><section className="booking-gate-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-gate-title"><span className="booking-gate-icon"><UserRound size={28}/></span><h2 id="booking-gate-title">{bookingGate==="phone"?"أضف رقم جوالك لإكمال الحجز":"سجّل الدخول لإكمال الحجز"}</h2><p>{bookingGate==="phone"?"باقي خطوة واحدة! أضف رقم جوالك عشان نقدر نكمل حجزك ونتواصل معاك عند الحاجة.":"تحتاج تسجّل الدخول أولاً عشان نربط الحجز بحسابك ونقدر نتابع تذكرتك."}</p><button type="button" className="booking-gate-primary" onClick={()=>{const gate=bookingGate;if(gate==="login")window.sessionStorage.setItem("haddir_booking_phone_required","1");setBookingGate(null);setEventResetKey(value=>value+1);setActiveTab("profile");setAuthMessage(gate==="login"?"سجّل الدخول لمواصلة الحجز.":"أضف رقم جوالك لمواصلة الحجز.");if(gate==="phone")setProfileEditing(true);window.scrollTo({top:0,behavior:"smooth"});}}>{bookingGate==="phone"?"إضافة رقم الجوال":"الانتقال لتسجيل الدخول"}</button><button type="button" className="booking-gate-secondary" onClick={()=>setBookingGate(null)}>لاحقاً</button></section></div>}
 {!isGatekeeperPage&&!isEventDetailOpen&&<BottomNav activeTab={activeTab} unreadCount={unreadNotificationCount} onNavigate={go}/>}
 </>
 
 </AppShell>;
}