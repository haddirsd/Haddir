"use client";
import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { AppHeader } from "../components/layout/AppHeader";
import { AppOverlays } from "../components/layout/AppOverlays";
import { BottomNav } from "../components/layout/BottomNav";
import { DesktopNav } from "../components/layout/DesktopNav";
import { formatEventDate } from "../features/events/events.formatters";
import { ProfileWorkspace } from "../features/customer-account/components/ProfileWorkspace";
import { EventsWorkspace } from "../features/events/components/EventsWorkspace";
import { TicketWorkspace } from "../features/customer-account/components/TicketWorkspace";
import { NotificationsWorkspace } from "../features/customer-account/components/NotificationsWorkspace";
import { useCustomerAccount } from "../features/customer-account/hooks/useCustomerAccount";
import { CUSTOMER_TICKETS_PAGE_SIZE } from "../features/customer-account/services/customer-account.service";
import { useCustomerAccountActions } from "../features/customer-account/hooks/useCustomerAccountActions";
import { useCustomerTicketsView } from "../features/customer-account/hooks/useCustomerTicketsView";
import { useCustomerNotificationView } from "../features/customer-account/hooks/useCustomerNotificationView";
import { useAuth } from "../features/auth/hooks/useAuth";
import type { AccountDialog } from "../features/customer-account/components/AccountDialogs";
import { useAppNavigation } from "../components/layout/hooks/useAppNavigation";
import { useAppTheme } from "../components/layout/hooks/useAppTheme";
import { GatekeeperPage } from "../features/gatekeeper/GatekeeperPage";
import { OrganizerTermsConsent } from "../features/legal/OrganizerTermsConsent";
export default function Home(){
 const [deletingAccount,setDeletingAccount]=useState(false);
 const [searchQuery,setSearchQuery]=useState("");
 const [notificationFilter,setNotificationFilter]=useState<"unread"|"read">("unread");
 const [notificationPage,setNotificationPage]=useState(1);
 const { darkMode, setDarkMode } = useAppTheme();
 const [accountDialog,setAccountDialog]=useState<AccountDialog>(null),[deleteEmailInput,setDeleteEmailInput]=useState(""),[uiNotice,setUiNotice]=useState("");
 const [bookingGate,setBookingGate]=useState<"login"|"phone"|null>(null);
 const [isEventDetailOpen,setIsEventDetailOpen]=useState(false);
 const [profileSaving,setProfileSaving]=useState(false);
 const { activeTab, setActiveTab, showPrivacySecurity, setShowPrivacySecurity, eventResetKey, setEventResetKey, activeWorkspace, isGatekeeperPage, go, backFromGatekeeper, closeGatekeeper } = useAppNavigation();
 const { authUser, userRole, pendingLegalRole, acceptOrganizerTerms, assignedEvent, fullName, setFullName, email, phone, setPhone, avatarUrl, profileEditing, setProfileEditing, saved, setSaved, authMessage, setAuthMessage } = useAuth();
 const ticketsView = useCustomerTicketsView(setUiNotice);
 const { myTickets, myTicketCounts, myNotifications, myNotificationsTotal, myNotificationsFilteredTotal, myUnreadNotificationCount, accountDataLoading, accountDataError, notificationsLoading, notificationsError, markNotificationRead: markCustomerNotificationReadAction, markAllNotificationsRead: markAllCustomerNotificationsReadAction } = useCustomerAccount(authUser?.id ?? null, ticketsView.filter === "new" ? "valid" : "used", ticketsView.page, ticketsView.setPage, notificationFilter, notificationPage, setNotificationPage);
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
  filter: notificationFilter,
  setFilter: setNotificationFilter,
  page: notificationPage,
  setPage: setNotificationPage,
  unreadCount: myUnreadNotificationCount,
  filteredTotal: myNotificationsFilteredTotal,
  markNotificationRead: markCustomerNotificationReadAction,
  markAllNotificationsRead: markAllCustomerNotificationsReadAction,
  onNavigateToTickets: () => go("tickets"),
 });

 return <AppShell darkMode={darkMode}>
 <AppHeader
  activeTab={activeTab}
  darkMode={darkMode}
  searchValue={searchQuery}
  onSearchChange={setSearchQuery}
  isEventDetailOpen={isEventDetailOpen}
  isGatekeeperPage={isGatekeeperPage}
  showPrivacySecurity={showPrivacySecurity}
  onGoHome={()=>go("home")}
  onToggleTheme={()=>setDarkMode(value=>!value)}
  onBackFromPrivacy={()=>setShowPrivacySecurity(false)}
  onBackFromGatekeeper={backFromGatekeeper}
 />
 {pendingLegalRole === "advertiser" && <OrganizerTermsConsent onAccept={acceptOrganizerTerms} />}
 {!isGatekeeperPage&&(!showPrivacySecurity||!isEventDetailOpen)&&<>
  <DesktopNav activeTab={activeTab} unreadCount={notificationView.unreadCount} ticketCount={myTicketCounts.valid + myTicketCounts.used} darkMode={darkMode} onNavigate={go} className={showPrivacySecurity?"hide-desktop":""}/>
  <BottomNav activeTab={activeTab} unreadCount={notificationView.unreadCount} onNavigate={go} className={isEventDetailOpen?"hide-mobile":""}/>
 </>}
 <div className="app-content">
 <EventsWorkspace
  showHome={!isGatekeeperPage&&activeTab==="home"}
  searchQuery={searchQuery}
  onSearchChange={setSearchQuery}
  resetKey={eventResetKey}
  authUser={authUser}
  onEventOpenChange={setIsEventDetailOpen}
  phone={phone}
  onRequireLogin={()=>setBookingGate("login")}
  onRequirePhone={()=>setBookingGate("phone")}
  onGoNotifications={()=>go("notifications")}
 />
 {!isGatekeeperPage&&activeTab==="tickets"&&<TicketWorkspace
  loading={accountDataLoading}
  error={accountDataError}
  tickets={myTickets}
  ticketCounts={myTicketCounts}
  filter={ticketsView.filter}
  page={ticketsView.page}
  pageSize={CUSTOMER_TICKETS_PAGE_SIZE}
  expandedTicketId={ticketsView.expandedTicketId}
  onFilterChange={ticketsView.changeFilter}
  onPageChange={ticketsView.changePage}
  onToggleTicket={ticketsView.toggleTicket}
  onDownloadTicket={(ticket)=>void ticketsView.downloadTicket(ticket)}
  formatEventDate={formatEventDate}
 />}
 {!isGatekeeperPage&&activeTab==="notifications"&&<NotificationsWorkspace
  loading={notificationsLoading}
  error={notificationsError}
  notifications={myNotifications}
  totalCount={myNotificationsTotal}
  filteredTotal={notificationView.filteredTotal}
  page={notificationView.page}
  pageSize={25}
  onPageChange={notificationView.setPage}
  filteredNotifications={notificationView.filteredNotifications}
  filter={notificationView.filter}
  unreadCount={notificationView.unreadCount}
  onFilterChange={notificationView.setFilter}
  onMarkAllRead={()=>void notificationView.markAllRead()}
  onOpenNotification={(notification)=>void notificationView.openNotification(notification)}
  onToggleRead={(notification)=>void notificationView.markOneRead(notification)}
 />}
 {!isGatekeeperPage&&activeTab==="profile"&&<ProfileWorkspace
  userId={authUser?.id ?? null} authUser={authUser} userRole={userRole} fullName={fullName} setFullName={setFullName} email={email}
  phone={phone} setPhone={setPhone} avatarUrl={avatarUrl}
  profileEditing={profileEditing} setProfileEditing={setProfileEditing}
  saved={saved} setSaved={setSaved} authMessage={authMessage} setAuthMessage={setAuthMessage}
  profileSaving={profileSaving} deletingAccount={deletingAccount} darkMode={darkMode}
  setDarkMode={setDarkMode} showPrivacySecurity={showPrivacySecurity}
  setShowPrivacySecurity={setShowPrivacySecurity} saveProfile={()=>void accountActions.saveProfile()}
  signInWithGoogle={()=>void accountActions.signInWithGoogle()} signInWithEmail={accountActions.signInWithEmail} deleteAccount={accountActions.deleteAccount} signOut={accountActions.signOut}
/>}
{isGatekeeperPage&&<GatekeeperPage
   authUser={authUser}
   userRole={userRole}
   assignedEvent={assignedEvent}
   isGatekeeperPage={isGatekeeperPage}
   activeWorkspace={activeWorkspace}
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

 </AppShell>;
}