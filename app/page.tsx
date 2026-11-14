"use client";
import { useEffect, useState } from "react";
import { WelcomeSplash } from "../components/layout/WelcomeSplash";
import { AppShell } from "../components/layout/AppShell";
import { AppHeader } from "../components/layout/AppHeader";
import { AppOverlays } from "../components/layout/AppOverlays";
import { BottomNav, DesktopNav } from "../components/layout/BottomNav";
import { formatEventDate } from "../features/events/events.formatters";
import { ProfileWorkspace } from "../features/customer-account/components/ProfileWorkspace";
import { EventsWorkspace } from "../features/events/components/EventsWorkspace";
import { TicketWorkspace } from "../features/customer-account/components/TicketWorkspace";
import { NotificationsWorkspace } from "../features/customer-account/components/NotificationsWorkspace";
import { useCustomerAccount } from "../features/customer-account/hooks/useCustomerAccount";
import { useCustomerAccountActions } from "../features/customer-account/hooks/useCustomerAccountActions";
import { useCustomerTicketsView } from "../features/customer-account/hooks/useCustomerTicketsView";
import { useCustomerNotificationView } from "../features/customer-account/hooks/useCustomerNotificationView";
import { useAuth } from "../features/auth/hooks/useAuth";
import { useGatekeeper } from "../features/gatekeeper/hooks/useGatekeeper";
import { GatekeeperWorkspace } from "../features/gatekeeper/components/GatekeeperWorkspace";
import type { AccountDialog } from "../features/customer-account/components/AccountDialogs";
import { useAppNavigation } from "../components/layout/hooks/useAppNavigation";
import { useAppTheme } from "../components/layout/hooks/useAppTheme";
export default function Home(){
 const [deletingAccount,setDeletingAccount]=useState(false);
 const { darkMode, setDarkMode } = useAppTheme();
 const [accountDialog,setAccountDialog]=useState<AccountDialog>(null),[deleteEmailInput,setDeleteEmailInput]=useState(""),[uiNotice,setUiNotice]=useState("");
 const [bookingGate,setBookingGate]=useState<"login"|"phone"|null>(null);
 const [isEventDetailOpen,setIsEventDetailOpen]=useState(false);
 const [profileSaving,setProfileSaving]=useState(false);
 const { activeTab, setActiveTab, showPrivacySecurity, setShowPrivacySecurity, eventResetKey, setEventResetKey, activeWorkspace, isGatekeeperPage, go, backFromGatekeeper, closeGatekeeper } = useAppNavigation();
 const { authUser, userRole, assignedEvent, fullName, setFullName, email, phone, setPhone, avatarUrl, profileEditing, setProfileEditing, saved, setSaved, authMessage, setAuthMessage } = useAuth();
 const { myTickets, myNotifications, accountDataLoading, accountDataError, markNotificationRead: markCustomerNotificationReadAction, markAllNotificationsRead: markAllCustomerNotificationsReadAction } = useCustomerAccount(authUser?.id ?? null);
 const ticketsView = useCustomerTicketsView(setUiNotice);
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
 const notificationView = useCustomerNotificationView({
  notifications: myNotifications,
  markNotificationRead: markCustomerNotificationReadAction,
  markAllNotificationsRead: markAllCustomerNotificationsReadAction,
  onNavigateToTickets: () => go("tickets"),
 });

 return <AppShell darkMode={darkMode}>
 <>
 <AppHeader
  activeTab={activeTab}
  darkMode={darkMode}
  isEventDetailOpen={isEventDetailOpen}
  isGatekeeperPage={isGatekeeperPage}
  showPrivacySecurity={showPrivacySecurity}
  onGoHome={()=>go("home")}
  onToggleTheme={()=>setDarkMode(value=>!value)}
  onBackFromPrivacy={()=>setShowPrivacySecurity(false)}
  onBackFromGatekeeper={backFromGatekeeper}
 />
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
  filter={ticketsView.filter}
  expandedTicketId={ticketsView.expandedTicketId}
  onFilterChange={ticketsView.changeFilter}
  onToggleTicket={ticketsView.toggleTicket}
  onDownloadTicket={(ticket)=>void ticketsView.downloadTicket(ticket)}
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
   onClose={closeGatekeeper}
  />}
 </div>
 <AppOverlays
  uiNotice={uiNotice}
  onCloseNotice={()=>setUiNotice("")}
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
  onCloseAccountDialog={()=>setAccountDialog(null)}
  bookingGate={bookingGate}
  onContinueBookingGate={()=>{
   const gate=bookingGate;
   if(!gate)return;
   if(gate==="login")window.sessionStorage.setItem("haddir_booking_phone_required","1");
   setBookingGate(null);
   setEventResetKey(value=>value+1);
   setActiveTab("profile");
   setAuthMessage(gate==="login"?"سجّل الدخول لمواصلة الحجز.":"أضف رقم جوالك لمواصلة الحجز.");
   if(gate==="phone")setProfileEditing(true);
   window.scrollTo({top:0,behavior:"smooth"});
  }}
  onCloseBookingGate={()=>setBookingGate(null)}
 />
 {!isGatekeeperPage&&!isEventDetailOpen&&<BottomNav activeTab={activeTab} unreadCount={notificationView.unreadCount} onNavigate={go}/>}
 </>
 
 </AppShell>;
}