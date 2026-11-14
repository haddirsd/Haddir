"use client";
import { useEffect, useState } from "react";
import { WelcomeSplash } from "../components/layout/WelcomeSplash";
import { THEME_STORAGE_KEY } from "../lib/constants";
import { AppShell } from "../components/layout/AppShell";
import { BottomNav, DesktopNav } from "../components/layout/BottomNav";
import { PageHeader } from "../components/layout/PageHeader";
import { formatEventDate } from "../features/events/events.formatters";
import { downloadTicketAsImage } from "../features/customer-account/utils/ticket-image";
import { ProfileWorkspace } from "../features/customer-account/components/ProfileWorkspace";
import { EventsWorkspace } from "../features/events/components/EventsWorkspace";
import { TicketWorkspace } from "../features/customer-account/components/TicketWorkspace";
import { NotificationsWorkspace } from "../features/customer-account/components/NotificationsWorkspace";
import { useCustomerAccount } from "../features/customer-account/hooks/useCustomerAccount";
import { useCustomerAccountActions } from "../features/customer-account/hooks/useCustomerAccountActions";
import { useCustomerNotificationView } from "../features/customer-account/hooks/useCustomerNotificationView";
import { useAuth } from "../features/auth/hooks/useAuth";
import { useGatekeeper } from "../features/gatekeeper/hooks/useGatekeeper";
import { GatekeeperWorkspace } from "../features/gatekeeper/components/GatekeeperWorkspace";
import { HaddirDialog } from "../components/ui/HaddirDialog";
import { AccountDialogs, type AccountDialog } from "../features/customer-account/components/AccountDialogs";
import { Bell, Ticket, UserRound, ChevronLeft, ScanLine, ShieldCheck, Sun, Moon } from "lucide-react";

type Tab="home"|"tickets"|"notifications"|"profile";
export default function Home(){
 const [activeTab,setActiveTab]=useState<Tab>("home"),[darkMode,setDarkMode]=useState(false),[showPrivacySecurity,setShowPrivacySecurity]=useState(false),[deletingAccount,setDeletingAccount]=useState(false);
 const [accountDialog,setAccountDialog]=useState<AccountDialog>(null),[deleteEmailInput,setDeleteEmailInput]=useState(""),[uiNotice,setUiNotice]=useState("");
 const [bookingGate,setBookingGate]=useState<"login"|"phone"|null>(null);
 const [eventResetKey,setEventResetKey]=useState(0),[isEventDetailOpen,setIsEventDetailOpen]=useState(false);
 const [profileSaving,setProfileSaving]=useState(false);
 const [activeWorkspace,setActiveWorkspace]=useState<"customer"|"organizer"|"gatekeeper"|"advertiser"|"admin"|"owner"|null>(null);
 const [isGatekeeperPage,setIsGatekeeperPage]=useState(false);
 const { authUser, userRole, assignedEvent, fullName, setFullName, email, phone, setPhone, avatarUrl, profileEditing, setProfileEditing, saved, setSaved, authMessage, setAuthMessage } = useAuth();
 const { myTickets, myNotifications, accountDataLoading, accountDataError, markNotificationRead: markCustomerNotificationReadAction, markAllNotificationsRead: markAllCustomerNotificationsReadAction } = useCustomerAccount(authUser?.id ?? null);
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
 const gatekeeper = useGatekeeper({ authUser, assignedEvent, userRole, isGatekeeperPage, activeWorkspace });
 const {
  gatekeeperCode, setGatekeeperCode, gatekeeperResult, setGatekeeperResult,
  gatekeeperLoading, gatekeeperOnline, manualEntryOpen, setManualEntryOpen,
  gatekeeperCounts, gatekeeperHistory: gatekeeperManualHistory, gatekeeperHistoryLoading,
  scannerOpen, setScannerOpen, videoRef, runGatekeeperAction, openScanner, openManualEntry, acknowledgeGatekeeperResult,
 } = gatekeeper;
 useEffect(()=>{if(!authUser){setGatekeeperResult(null);setGatekeeperCode("");}},[authUser]);
 const accountActions = useCustomerAccountActions({
  authUser,
  fullName,
  phone,
  deleteEmailInput,
  setFullName,
  setPhone,
  setProfileEditing,
  setSaved,
  setAuthMessage,
  setProfileSaving,
  setDeletingAccount,
  setAccountDialog,
  setDeleteEmailInput,
 });
 const go=(tab:Tab)=>{
  setShowPrivacySecurity(false);setEventResetKey(value=>value+1);setActiveTab(tab);
  const url=new URL(window.location.href);
  if(tab==="home")url.searchParams.delete("tab");else url.searchParams.set("tab",tab);
  url.searchParams.delete("workspace");setIsGatekeeperPage(false);setActiveWorkspace(null);
  window.history.replaceState({}, "", url.pathname+url.search+url.hash);
  window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
 };
 const notificationView = useCustomerNotificationView({
  notifications: myNotifications,
  markNotificationRead: markCustomerNotificationReadAction,
  markAllNotificationsRead: markAllCustomerNotificationsReadAction,
  onNavigateToTickets: () => go("tickets"),
 });
 const downloadTicket=async(ticket:any)=>{
  try{
   await downloadTicketAsImage(ticket,formatEventDate);
  }catch(error){
   console.error("Ticket image export failed",error);
   setUiNotice("تعذر حفظ التذكرة كصورة. حاول مرة أخرى.");
  }
 };

 return <AppShell darkMode={darkMode}>
 <>
 {!isEventDetailOpen&&(showPrivacySecurity&&!isGatekeeperPage?<header className="screen-topbar privacy-screen-topbar"><button type="button" className="privacy-back-button" onClick={()=>setShowPrivacySecurity(false)}><ChevronLeft size={18}/> رجوع</button><strong>الخصوصية والأمان</strong><span className="screen-icon"><ShieldCheck/></span></header>:isGatekeeperPage?<header className="screen-topbar gatekeeper-page-topbar"><button type="button" className="btn btn-outline" onClick={()=>{setIsGatekeeperPage(false);setActiveWorkspace(null);const url=new URL(window.location.href);url.searchParams.delete("workspace");window.location.assign(url.pathname+url.search+url.hash);}}>العودة للملف الشخصي</button><strong>مسح التذاكر</strong><span className="screen-icon"><ScanLine/></span></header>:activeTab==="home"?<header className="topbar"><div className="container header-inner"><button className="brand brand-button" onClick={()=>go("home")}><img className="brand-logo" src={darkMode?"/dark.svg?v=20261111-home-logo":"/light.svg?v=20261111-home-logo"} alt="حاضر" /></button><div className="desktop-greeting">من السودان، لكل لحظة تستاهل الحضور.</div><button className="header-icon theme-toggle" type="button" aria-label={darkMode?"تفعيل الوضع النهاري":"تفعيل الوضع الليلي"} aria-pressed={darkMode} title={darkMode?"تفعيل الوضع النهاري":"تفعيل الوضع الليلي"} onClick={()=>setDarkMode(v=>!v)}><span className="theme-toggle-track" aria-hidden="true"><span className="theme-toggle-knob">{darkMode?<Sun size={17} strokeWidth={2.3}/>:<Moon size={16} strokeWidth={2.3}/>}</span></span></button></div></header>:<PageHeader title={({tickets:"تذاكري",notifications:"الإشعارات",profile:"الملف الشخصي"} as Record<string,string>)[activeTab]} icon={activeTab==="tickets"?<Ticket/>:activeTab==="notifications"?<Bell/>:<UserRound/>}/>)}
 {!isGatekeeperPage&&!showPrivacySecurity&&<DesktopNav activeTab={activeTab} unreadCount={notificationView.unreadCount} onNavigate={go}/>}
 <div className="app-content">
 <WelcomeSplash />
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
  filteredNotifications={notificationView.filteredNotifications}
  filter={notificationView.filter}
  unreadCount={notificationView.unreadCount}
  onFilterChange={notificationView.setFilter}
  onMarkAllRead={()=>void notificationView.markAllRead()}
  onOpenNotification={(notification)=>void notificationView.openNotification(notification)}
  onToggleRead={(notification)=>void notificationView.markOneRead(notification)}
 />}
 {!isGatekeeperPage&&activeTab==="profile"&&<ProfileWorkspace
  authUser={authUser} userRole={userRole} fullName={fullName} setFullName={setFullName} email={email}
  phone={phone} setPhone={setPhone} avatarUrl={avatarUrl}
  profileEditing={profileEditing} setProfileEditing={setProfileEditing}
  saved={saved} setSaved={setSaved} authMessage={authMessage} setAuthMessage={setAuthMessage}
  profileSaving={profileSaving} deletingAccount={deletingAccount} darkMode={darkMode}
  setDarkMode={setDarkMode} showPrivacySecurity={showPrivacySecurity}
  setShowPrivacySecurity={setShowPrivacySecurity} saveProfile={()=>void accountActions.saveProfile()}
  signInWithGoogle={()=>void accountActions.signInWithGoogle()} deleteAccount={accountActions.deleteAccount} signOut={accountActions.signOut}
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
 <AccountDialogs
  accountDialog={accountDialog}
  deleteEmailInput={deleteEmailInput}
  setDeleteEmailInput={setDeleteEmailInput}
  deletingAccount={deletingAccount}
  onConfirmSignOut={accountActions.confirmSignOut}
  onContinueDelete={()=>{
   if(!deleteEmailInput.trim()){setAuthMessage("اكتب البريد الإلكتروني أولاً.");return;}
   if(deleteEmailInput.trim().toLowerCase()!==authUser?.email?.toLowerCase()){setAccountDialog(null);setAuthMessage("البريد الإلكتروني غير مطابق. لم يتم حذف أي بيانات.");return;}
   setAccountDialog("delete-final");
  }}
  onExecuteDelete={accountActions.executeDeleteAccount}
  onClose={()=>setAccountDialog(null)}
 />
 {bookingGate&&<div className="booking-gate-backdrop" role="presentation"><section className="booking-gate-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-gate-title"><span className="booking-gate-icon"><UserRound size={28}/></span><h2 id="booking-gate-title">{bookingGate==="phone"?"أضف رقم جوالك لإكمال الحجز":"سجّل الدخول لإكمال الحجز"}</h2><p>{bookingGate==="phone"?"باقي خطوة واحدة! أضف رقم جوالك عشان نقدر نكمل حجزك ونتواصل معاك عند الحاجة.":"تحتاج تسجّل الدخول أولاً عشان نربط الحجز بحسابك ونقدر نتابع تذكرتك."}</p><button type="button" className="booking-gate-primary" onClick={()=>{const gate=bookingGate;if(gate==="login")window.sessionStorage.setItem("haddir_booking_phone_required","1");setBookingGate(null);setEventResetKey(value=>value+1);setActiveTab("profile");setAuthMessage(gate==="login"?"سجّل الدخول لمواصلة الحجز.":"أضف رقم جوالك لمواصلة الحجز.");if(gate==="phone")setProfileEditing(true);window.scrollTo({top:0,behavior:"smooth"});}}>{bookingGate==="phone"?"إضافة رقم الجوال":"الانتقال لتسجيل الدخول"}</button><button type="button" className="booking-gate-secondary" onClick={()=>setBookingGate(null)}>لاحقاً</button></section></div>}
 {!isGatekeeperPage&&!isEventDetailOpen&&<BottomNav activeTab={activeTab} unreadCount={notificationView.unreadCount} onNavigate={go}/>}
 </>
 
 </AppShell>;
}