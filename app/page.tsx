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
import { Bell, CheckCircle2, House, Sparkles, Ticket, UserRound, ChevronLeft, ScanLine, ShieldCheck, ClipboardList, Pencil, Sun, Moon, Share2, CloudUpload, LockKeyhole, Trash2 } from "lucide-react";

type Tab="home"|"tickets"|"notifications"|"profile";
export default function Home(){
 const [activeTab,setActiveTab]=useState<Tab>("home"),[darkMode,setDarkMode]=useState(false),[showPrivacySecurity,setShowPrivacySecurity]=useState(false),[deletingAccount,setDeletingAccount]=useState(false);
 const [bookingGate,setBookingGate]=useState<"login"|"phone"|null>(null);
 const [eventResetKey,setEventResetKey]=useState(0),[isEventDetailOpen,setIsEventDetailOpen]=useState(false);
 const [fullName,setFullName]=useState(""),[email,setEmail]=useState(""),[phone,setPhone]=useState(""),[avatarUrl,setAvatarUrl]=useState(""),[profileEditing,setProfileEditing]=useState(false),[saved,setSaved]=useState(false),[profileSaving,setProfileSaving]=useState(false);
 const [authUser,setAuthUser]=useState<{id:string;email?:string;user_metadata?:Record<string,unknown>}|null>(null),[userRole,setUserRole]=useState("customer"),[authMessage,setAuthMessage]=useState(""),[activeWorkspace,setActiveWorkspace]=useState<"customer"|"organizer"|"gatekeeper"|"advertiser"|"admin"|"owner"|null>(null);
 const [isGatekeeperPage,setIsGatekeeperPage]=useState(false);
 const [showWelcome,setShowWelcome]=useState(true),[welcomeFading,setWelcomeFading]=useState(false),[welcomeGreeting,setWelcomeGreeting]=useState("أهلاً بيك في حاضر");
 const [assignedEvent,setAssignedEvent]=useState<any|null>(null);
 const [myTickets,setMyTickets]=useState<any[]>([]),[myNotifications,setMyNotifications]=useState<any[]>([]),[accountDataLoading,setAccountDataLoading]=useState(false),[accountDataError,setAccountDataError]=useState("");
 const [notificationFilter,setNotificationFilter]=useState<"unread"|"read">("unread");
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
    supabase.from("tickets").select("id,booking_item_id,ticket_code,status,issued_at,events(title,starts_at,is_continuous,venue,cover_image_url),ticket_types(name),bookings!inner(booking_number,user_id),booking_items(quantity)").eq("bookings.user_id",authUser.id).order("issued_at",{ascending:false}),
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
 useEffect(()=>{document.documentElement.dataset.theme=darkMode?"dark":"light";document.documentElement.style.colorScheme=darkMode?"dark":"light";window.localStorage.setItem("haddir-theme",darkMode?"dark":"light");const themeMeta=document.querySelector('meta[name="theme-color"]');themeMeta?.setAttribute("content",darkMode?"#1D135D":"#F6F4FF");},[darkMode]);
 useEffect(()=>{const hour=Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Khartoum",hour:"2-digit",hourCycle:"h23"}).format(new Date()));setWelcomeGreeting(hour>=5&&hour<11?"صباح الخير":hour>=11&&hour<17?"نهارك سعيد":hour>=17&&hour<23?"مساء الخير":"ليلة سعيدة");let seen=false;try{seen=sessionStorage.getItem("haddir_splash")==="1";}catch(e){}if(seen){setShowWelcome(false);return;}try{sessionStorage.setItem("haddir_splash","1");}catch(e){}let removeTimer: number|undefined;const fadeTimer=window.setTimeout(()=>{setWelcomeFading(true);removeTimer=window.setTimeout(()=>setShowWelcome(false),450);},2600);return()=>{window.clearTimeout(fadeTimer);if(removeTimer!==undefined)window.clearTimeout(removeTimer);};},[]);
 useEffect(()=>{const supabase=getSupabaseBrowserClient();if(!supabase){setAuthMessage("تسجيل الدخول يحتاج إعداد مفاتيح Supabase في بيئة الموقع.");return;}let alive=true;const load=async(user:{id:string;email?:string;user_metadata?:Record<string,unknown>}|null)=>{if(!alive)return;setAuthUser(user as typeof authUser);if(user){const {data}=await supabase.from("profiles").select("role,full_name,phone").eq("id",user.id).maybeSingle();if(!alive)return;setUserRole(data?.role||"customer");const {data:assignmentRows}=await supabase.from("event_role_assignments").select("event_id,assignment_role,events(id,title,venue,city,starts_at,status)").eq("user_id",user.id).in("assignment_role",["gatekeeper","organizer","advertiser"]).limit(1);if(!alive)return;setAssignedEvent(assignmentRows?.[0]||null);const metadataName=String(user.user_metadata?.full_name||user.user_metadata?.name||"");const metadataAvatar=String(user.user_metadata?.avatar_url||user.user_metadata?.picture||"");setFullName(String(data?.full_name||metadataName||""));setPhone(String(data?.phone||""));setEmail(user.email||"");setAvatarUrl(metadataAvatar);const bookingPhoneRequired=window.sessionStorage.getItem("haddir_booking_phone_required")==="1";if(bookingPhoneRequired)window.sessionStorage.removeItem("haddir_booking_phone_required");setProfileEditing(bookingPhoneRequired&&!String(data?.phone||"").trim());if(bookingPhoneRequired&&!String(data?.phone||"").trim())setAuthMessage("أضف رقم جوالك لمواصلة الحجز.");setSaved(false);}else{setUserRole("customer");setAssignedEvent(null);setGatekeeperResult(null);setGatekeeperCode("");setFullName("");setEmail("");setPhone("");setAvatarUrl("");setProfileEditing(false);setSaved(false);setActiveWorkspace(null);}};supabase.auth.getSession().then(({data})=>load(data.session?.user??null));const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{void load(session?.user??null);});return()=>{alive=false;subscription.unsubscribe();};},[]);
 const gatekeeper = useGatekeeper({ authUser, assignedEvent, userRole, isGatekeeperPage, activeWorkspace });
 const {
  gatekeeperCode, setGatekeeperCode, gatekeeperResult, setGatekeeperResult,
  gatekeeperLoading, gatekeeperOnline, manualEntryOpen, setManualEntryOpen,
  gatekeeperCounts, gatekeeperHistory: gatekeeperManualHistory, gatekeeperHistoryLoading,
  scannerOpen, setScannerOpen, videoRef, runGatekeeperAction, openScanner, openManualEntry, acknowledgeGatekeeperResult,
 } = gatekeeper;
 const signInWithGoogle=async()=>{const supabase=getSupabaseBrowserClient();if(!supabase){setAuthMessage("إعدادات تسجيل الدخول غير مكتملة على الموقع.");return;}const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin}});if(error)setAuthMessage(error.message);};
 const saveProfile=async()=>{if(!authUser){setAuthMessage("سجّل الدخول أولاً لحفظ بياناتك.");return;}const normalizedPhone=phone.replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\s+/g,"");if(!/^0\d{9}$/.test(normalizedPhone)){setAuthMessage("رقم الهاتف لازم يكون 10 خانات بالضبط ويبدأ بصفر، مثال: 09XXXXXXXX.");return;}const supabase=getSupabaseBrowserClient();if(!supabase){setAuthMessage("تعذر الاتصال بقاعدة البيانات حالياً.");return;}setProfileSaving(true);setSaved(false);setAuthMessage("");const {data,error}=await supabase.from("profiles").update({phone:normalizedPhone}).eq("id",authUser.id).select("phone").single();setProfileSaving(false);if(error){setAuthMessage("ما قدرنا نحفظ رقمك. تأكد من الاتصال وحاول مرة تانية.");return;}setPhone(data.phone||normalizedPhone);setProfileEditing(false);setSaved(true);};
 const deleteAccount=async()=>{
  if(!authUser?.email){setAuthMessage("سجّل الدخول أولاً عشان تقدر تحذف حسابك.");return;}
  const confirmedEmail=window.prompt("لتأكيد الحذف النهائي، اكتب البريد الإلكتروني المرتبط بحسابك:");
  if(confirmedEmail===null)return;
  if(confirmedEmail.trim().toLowerCase()!==authUser.email.toLowerCase()){setAuthMessage("البريد الإلكتروني غير مطابق. لم يتم حذف أي بيانات.");return;}
  if(!window.confirm("تنبيه أخير: سيتم حذف حسابك وإيصالات التحويل والبيانات الشخصية. ستبقى سجلات المعاملات اللازمة محفوظة بعد إزالة بيانات تعريفك. هل تريد المتابعة؟ لن يسمح النظام بالحذف إذا كانت لديك تذكرة مؤكدة لفعالية قادمة."))return;
  const supabase=getSupabaseBrowserClient();if(!supabase){setAuthMessage("تعذر الاتصال بالخدمة حالياً.");return;}
  setDeletingAccount(true);setAuthMessage("");
  const {data,error}=await supabase.functions.invoke("delete-customer-account",{body:{confirm_email:confirmedEmail.trim()}});
  setDeletingAccount(false);
  if(error||!data?.success){let failureMessage=data?.error;try{if(!failureMessage&&error)failureMessage=(await (error as any).context?.json?.())?.error;}catch{}setAuthMessage(failureMessage||"تعذر حذف الحساب حالياً. لم نتمكن من تأكيد اكتمال العملية.");return;}
  await supabase.auth.signOut();
  window.location.assign("/?tab=profile");
 };
 const signOut=async()=>{if(!window.confirm("هل تريد تسجيل الخروج من حسابك؟ ستعود إلى شاشة تسجيل الدخول."))return;const supabase=getSupabaseBrowserClient();if(supabase){const {error}=await supabase.auth.signOut();if(error){setAuthMessage("تعذر تسجيل الخروج حالياً. حاول مرة أخرى.");return;}}setAuthMessage("تم تسجيل الخروج بنجاح. يمكنك تسجيل الدخول مرة أخرى في أي وقت.");};

 const markNotificationRead=async(notification:any)=>{
  if(!authUser)return;
  const supabase=getSupabaseBrowserClient();if(!supabase)return;
  const {error}=await supabase.from("notifications").update({is_read:true}).eq("id",notification.id).eq("user_id",authUser.id);
  if(error){setAccountDataError("تعذر تحديث حالة الإشعار. "+error.message);return;}
  setMyNotifications(rows=>rows.map(row=>row.id===notification.id?{...row,is_read:true}:row));
  setNotificationFilter("read");
 };
 const markAllNotificationsRead=async()=>{
  if(!authUser)return;
  const supabase=getSupabaseBrowserClient();if(!supabase)return;
  const unreadIds=myNotifications.filter(n=>!n.is_read).map(n=>n.id);
  if(!unreadIds.length)return;
  const {error}=await supabase.from("notifications").update({is_read:true}).in("id",unreadIds).eq("user_id",authUser.id);
  if(error){setAccountDataError("تعذر تعليم الإشعارات كمقروءة. "+error.message);return;}
  setMyNotifications(rows=>rows.map(row=>({...row,is_read:true})));
  setNotificationFilter("read");
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
 }; const downloadTicket=async(ticket:any)=>{try{const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext("2d");if(!ctx)return;await document.fonts.ready;ctx.fillStyle="#eef6f9";ctx.fillRect(0,0,1080,1350);ctx.fillStyle="#fff";ctx.fillRect(48,48,984,1254);ctx.strokeStyle="#d8ecf3";ctx.lineWidth=3;ctx.strokeRect(48,48,984,1254);ctx.direction="rtl";ctx.textAlign="right";const right=950;const brandImg=new Image();const brandLoaded=new Promise<void>((resolve,reject)=>{brandImg.onload=()=>resolve();brandImg.onerror=()=>reject(new Error("Haddir logo failed"));});brandImg.src="/ticket.svg";await brandLoaded;ctx.drawImage(brandImg,790,70,160,80);ctx.fillStyle="#52707a";ctx.font="26px 'IBM Plex Sans Arabic',Arial";ctx.fillText("تذكرة دخول إلكترونية",right,190);ctx.strokeStyle="#b9d9e2";ctx.setLineDash([10,9]);ctx.beginPath();ctx.moveTo(100,230);ctx.lineTo(980,230);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="#52707a";ctx.font="26px 'IBM Plex Sans Arabic',Arial";ctx.fillText("الفعالية",right,300);ctx.fillStyle="#082028";ctx.font="bold 44px 'IBM Plex Sans Arabic',Arial";const eventTitle=String(ticket.events?.title||"فعالية");ctx.fillText(eventTitle.length>32?eventTitle.slice(0,32)+"…":eventTitle,right,365);ctx.fillStyle="#52707a";ctx.font="24px 'IBM Plex Sans Arabic',Arial";ctx.fillText("نوع التذكرة",right,455);ctx.fillText("رقم الحجز",520,455);ctx.fillStyle="#082028";ctx.font="bold 27px 'IBM Plex Sans Arabic',Arial";ctx.fillText(String(ticket.ticket_types?.name||"تذكرة"),right,500);ctx.fillText(String(ticket.bookings?.booking_number||"—"),520,500);ctx.fillStyle="#52707a";ctx.font="24px 'IBM Plex Sans Arabic',Arial";ctx.fillText("الموقع",right,575);ctx.fillText("التاريخ",520,575);ctx.fillStyle="#082028";ctx.font="bold 25px 'IBM Plex Sans Arabic',Arial";ctx.fillText(String(ticket.events?.venue||"—"),right,620);ctx.fillText(ticket.events?.is_continuous?"مستمر":ticket.events?.starts_at?formatEventDate(ticket.events.starts_at):"—",520,620);ctx.strokeStyle="#d8ecf3";ctx.setLineDash([10,9]);ctx.beginPath();ctx.moveTo(100,675);ctx.lineTo(980,675);ctx.stroke();ctx.setLineDash([]);const qr=document.querySelector('[data-ticket-id="'+String(ticket.id)+'"] .haddir-ticket-qr svg');if(!qr)throw new Error("QR unavailable");const svg=new XMLSerializer().serializeToString(qr);const img=new Image();const loaded=new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error("QR image failed"));});img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);await loaded;ctx.drawImage(img,360,700,360,360);ctx.fillStyle="#52707a";ctx.font="23px 'IBM Plex Sans Arabic',Arial";ctx.textAlign="center";ctx.fillText("امسح الرمز للتحقق من التذكرة",540,1100);ctx.fillStyle="#075985";ctx.font="bold 48px 'IBM Plex Sans Arabic',Arial";ctx.fillText(String(ticket.ticket_code||""),540,1170);ctx.fillStyle="#d8ecf3";ctx.fillRect(48,1200,984,102);ctx.fillStyle="#075985";ctx.font="bold 23px 'IBM Plex Sans Arabic',Arial";ctx.fillText("احتفظ بالتذكرة وأبرزها عند الدخول",540,1262);const link=document.createElement("a");link.download="haddir-ticket-"+String(ticket.ticket_code||ticket.id)+".png";link.href=canvas.toDataURL("image/png");link.click();}catch(error){console.error("Ticket image export failed",error);alert("تعذر حفظ التذكرة كصورة. حاول مرة أخرى.");}};

 return <main dir="rtl" lang="ar" className={"app-shell"+(darkMode?" theme-dark":"")}>
 <>
 {!isEventDetailOpen&&(showPrivacySecurity&&!isGatekeeperPage?<header className="screen-topbar privacy-screen-topbar"><button type="button" className="privacy-back-button" onClick={()=>setShowPrivacySecurity(false)}><ChevronLeft size={18}/> رجوع</button><strong>الخصوصية والأمان</strong><span className="screen-icon"><ShieldCheck/></span></header>:isGatekeeperPage?<header className="screen-topbar gatekeeper-page-topbar"><button type="button" className="btn btn-outline" onClick={()=>{setIsGatekeeperPage(false);setActiveWorkspace(null);const url=new URL(window.location.href);url.searchParams.delete("workspace");window.location.assign(url.pathname+url.search+url.hash);}}>العودة للملف الشخصي</button><strong>مسح التذاكر</strong><span className="screen-icon"><ScanLine/></span></header>:activeTab==="home"?<header className="topbar"><div className="container header-inner"><button className="brand brand-button" onClick={()=>go("home")}><img className="brand-logo" src={darkMode?"/dark.svg?v=20261111-home-logo":"/light.svg?v=20261111-home-logo"} alt="حاضر" /></button><div className="desktop-greeting">من السودان، لكل لحظة تستاهل الحضور.</div><button className="header-icon theme-toggle" type="button" aria-label={darkMode?"تفعيل الوضع النهاري":"تفعيل الوضع الليلي"} aria-pressed={darkMode} title={darkMode?"تفعيل الوضع النهاري":"تفعيل الوضع الليلي"} onClick={()=>setDarkMode(v=>!v)}><span className="theme-toggle-track" aria-hidden="true"><span className="theme-toggle-knob">{darkMode?<Sun size={17} strokeWidth={2.3}/>:<Moon size={16} strokeWidth={2.3}/>}</span></span></button></div></header>:<header className="screen-topbar"><span className="screen-topbar-spacer" aria-hidden="true"/><strong>{({tickets:"تذاكري",notifications:"الإشعارات",profile:"الملف الشخصي"} as Record<string,string>)[activeTab]}</strong><span className="screen-icon">{activeTab==="tickets"?<Ticket/>:activeTab==="notifications"?<Bell/>:<UserRound/>}</span></header>)}
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
 {!isGatekeeperPage&&activeTab==="profile"&&!showPrivacySecurity&&<section className="screen container profile-screen">
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

 {!isGatekeeperPage&&activeTab==="profile"&&showPrivacySecurity&&<section className="screen container privacy-screen">
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
 {bookingGate&&<div className="booking-gate-backdrop" role="presentation"><section className="booking-gate-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-gate-title"><span className="booking-gate-icon"><UserRound size={28}/></span><h2 id="booking-gate-title">{bookingGate==="phone"?"أضف رقم جوالك لإكمال الحجز":"سجّل الدخول لإكمال الحجز"}</h2><p>{bookingGate==="phone"?"باقي خطوة واحدة! أضف رقم جوالك عشان نقدر نكمل حجزك ونتواصل معاك عند الحاجة.":"تحتاج تسجّل الدخول أولاً عشان نربط الحجز بحسابك ونقدر نتابع تذكرتك."}</p><button type="button" className="booking-gate-primary" onClick={()=>{const gate=bookingGate;if(gate==="login")window.sessionStorage.setItem("haddir_booking_phone_required","1");setBookingGate(null);setEventResetKey(value=>value+1);setActiveTab("profile");setAuthMessage(gate==="login"?"سجّل الدخول لمواصلة الحجز.":"أضف رقم جوالك لمواصلة الحجز.");if(gate==="phone")setProfileEditing(true);window.scrollTo({top:0,behavior:"smooth"});}}>{bookingGate==="phone"?"إضافة رقم الجوال":"الانتقال لتسجيل الدخول"}</button><button type="button" className="booking-gate-secondary" onClick={()=>setBookingGate(null)}>لاحقاً</button></section></div>}
 {!isGatekeeperPage&&!isEventDetailOpen&&<nav className="bottom-nav" aria-label="التنقل الرئيسي"><button type="button" aria-current={activeTab==="home"?"page":undefined} aria-label="الرئيسية" className={activeTab==="home"?"selected":""} onClick={()=>go("home")}><House size={21}/><span className="nav-label">الرئيسية</span></button><button type="button" aria-current={activeTab==="tickets"?"page":undefined} aria-label="تذاكري" className={activeTab==="tickets"?"selected":""} onClick={()=>go("tickets")}><Ticket size={21}/><span className="nav-label">تذاكري</span></button><button type="button" aria-current={activeTab==="notifications"?"page":undefined} aria-label="الإشعارات" className={activeTab==="notifications"?"selected":""} onClick={()=>go("notifications")}><span className="nav-icon-wrap"><Bell size={21}/>{unreadNotificationCount>0&&<i className="nav-notification-dot" aria-label={`${unreadNotificationCount} إشعارات غير مقروءة`}/>}</span><span className="nav-label">الإشعارات</span></button><button type="button" aria-current={activeTab==="profile"?"page":undefined} aria-label="الملف الشخصي" className={activeTab==="profile"?"selected":""} onClick={()=>go("profile")}><UserRound size={21}/><span className="nav-label">الملف الشخصي</span></button></nav>}
 </>
 
 </main>;
}