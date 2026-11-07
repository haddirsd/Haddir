"use client";
import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";
import { useBooking } from "../features/booking/useBooking";
import { PaymentCheckout } from "../features/booking/components/PaymentCheckout";
import { BookingSuccess } from "../features/booking/components/BookingSuccess";
import { useGatekeeper } from "../features/gatekeeper/useGatekeeper";
import { GatekeeperWorkspace } from "../features/gatekeeper/components/GatekeeperWorkspace";
import { QRCodeSVG as QrCodeSVG } from "qrcode.react";
import { ArrowLeft, Copy, Wallet, Bell, CalendarDays, CheckCircle2, House, MapPin, Settings, Sparkles, Ticket, UserRound, ChevronLeft, Share2, ExternalLink, CreditCard, Download, ScanLine, ShieldCheck, ClipboardList } from "lucide-react";
type EventItem = {id:string;date:string;title:string;place:string;category:string;price:string;cover:string;coverImageUrl:string|null;tag:string;time:string;venue:string;status:string;map:string;about:string;isTrending:boolean;tiers:{id:string;name:string;description:string;price:string;priceValue:number;currency:string;quantityTotal:number;quantitySold:number;available:number;availableNow:boolean}[]};
const formatEventDate=(value:string)=>new Intl.DateTimeFormat("ar-SD",{weekday:"long",day:"numeric",month:"long"}).format(new Date(value));

const toNumber=(value:string)=>{const digits=value.replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));const n=Number(digits.replace(/[^0-9]/g,""));return Number.isFinite(n)?n:0};
const currencyLabel=(currency:string)=>({SDG:"ج.س",SAR:"ر.س",AED:"د.إ",USD:"$",EGP:"ج.م"}[currency.trim().toUpperCase()]||currency.trim().toUpperCase());
const formatMoney=(value:number,currency="SDG")=>new Intl.NumberFormat("ar-SD").format(value)+" "+currencyLabel(currency);
type Tab="home"|"tickets"|"notifications"|"profile";
export default function Home(){
 const [events,setEvents]=useState<EventItem[]>([]),[eventsLoading,setEventsLoading]=useState(true),[eventsError,setEventsError]=useState(""),[ticketTypesError,setTicketTypesError]=useState("");
 const [activeTab,setActiveTab]=useState<Tab>("home"),[selectedEvent,setSelectedEvent]=useState<string|null>(null),[selectedTier,setSelectedTier]=useState(0),[tierChosen,setTierChosen]=useState(false),[showPayment,setShowPayment]=useState(false),[darkMode,setDarkMode]=useState(false),[loginEmail,setLoginEmail]=useState("");
 const [fullName,setFullName]=useState(""),[email,setEmail]=useState(""),[phone,setPhone]=useState(""),[avatarUrl,setAvatarUrl]=useState(""),[profileEditing,setProfileEditing]=useState(false),[saved,setSaved]=useState(false),[profileSaving,setProfileSaving]=useState(false);
 const [authUser,setAuthUser]=useState<{id:string;email?:string;user_metadata?:Record<string,unknown>}|null>(null),[userRole,setUserRole]=useState("customer"),[authMessage,setAuthMessage]=useState(""),[activeWorkspace,setActiveWorkspace]=useState<"customer"|"organizer"|"gatekeeper"|"advertiser"|"admin"|"owner"|null>(null);
 const [isGatekeeperPage,setIsGatekeeperPage]=useState(false);
 const [ticketCount,setTicketCount]=useState(1);
 const [showWelcome,setShowWelcome]=useState(false);
 const [showAdvertiserStats,setShowAdvertiserStats]=useState(false);
 const [assignedEvent,setAssignedEvent]=useState<any|null>(null);
 useEffect(()=>{
  const handleBrowserBack=(event:PopStateEvent)=>{
   const pageState=(event.state as {haddirPage?:string}|null)?.haddirPage;
   if(pageState==="event-detail"){
    setShowPayment(false);
    return;
   }
   setSelectedEvent(null);
   setShowPayment(false);
   setSelectedTier(0);
   setTierChosen(false);
  };
  window.addEventListener("popstate",handleBrowserBack);
  return()=>window.removeEventListener("popstate",handleBrowserBack);
 },[]);
 const [advertiserStats,setAdvertiserStats]=useState<any|null>(null);
 const [advertiserStatsLoading,setAdvertiserStatsLoading]=useState(false);
 const [advertiserStatsError,setAdvertiserStatsError]=useState("");
 const [myTickets,setMyTickets]=useState<any[]>([]),[myNotifications,setMyNotifications]=useState<any[]>([]),[accountDataLoading,setAccountDataLoading]=useState(false),[accountDataError,setAccountDataError]=useState("");
 const [notificationFilter,setNotificationFilter]=useState<"all"|"unread"|"read">("all");
 const [ticketFilter,setTicketFilter]=useState<"new"|"used">("new");
 const [expandedTicketId,setExpandedTicketId]=useState<string|null>(null);
 const trendingEvents=events.filter(e=>e.isTrending);
 const trendingCarouselRef=useRef<HTMLDivElement|null>(null);
 const [trendingPaused,setTrendingPaused]=useState(false);
 const trendingDisplayEvents=[...trendingEvents].reverse();
 const trendingLoopEvents=trendingDisplayEvents.length>1?[...trendingDisplayEvents,...trendingDisplayEvents,...trendingDisplayEvents]:trendingDisplayEvents;
 useEffect(()=>{
  const count=trendingEvents.length;
  const carousel=trendingCarouselRef.current;
  if(count<2||!carousel||trendingPaused)return;
  let index=count*2-1;
  let resetTimer:number|undefined;
  const centerCard=(cardIndex:number,behavior:ScrollBehavior)=>{
   const cards=carousel.querySelectorAll<HTMLElement>(".trending-card");
   const card=cards[cardIndex];
   if(!card)return;
   const box=carousel.getBoundingClientRect();
   const rect=card.getBoundingClientRect();
   const left=rect.left-box.left+carousel.scrollLeft-(carousel.clientWidth-card.clientWidth)/2;
   if(behavior==="auto"){carousel.style.scrollBehavior="auto";carousel.scrollLeft=left;carousel.style.scrollBehavior="";}
   else carousel.scrollTo({left,behavior});
  };
  const initialFrame=window.requestAnimationFrame(()=>centerCard(index,"auto"));
  const interval=window.setInterval(()=>{
   index-=1;
   centerCard(index,"smooth");
   if(index<=count-1){
    resetTimer=window.setTimeout(()=>{
     index=count*2-1;
     centerCard(index,"auto");
    },720);
   }
  },3000);
  return()=>{
   window.cancelAnimationFrame(initialFrame);
   window.clearInterval(interval);
   if(resetTimer!==undefined)window.clearTimeout(resetTimer);
  };
 },[trendingEvents.length,trendingPaused]);

  useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const tab=params.get("tab");
  if(tab==="tickets"||tab==="notifications"||tab==="profile")setActiveTab(tab);
  if(params.get("workspace")==="gatekeeper"){setActiveWorkspace("gatekeeper");setIsGatekeeperPage(true);}
 },[]);
 useEffect(()=>{
  const supabase=getSupabaseBrowserClient();if(!supabase||!authUser)return;
  let alive=true;let firstLoad=true;setAccountDataLoading(true);setAccountDataError("");
  const loadAccountData=async()=>{
   const [ticketsResult,notificationsResult]=await Promise.all([
    supabase.from("tickets").select("id,booking_item_id,ticket_code,status,issued_at,events(title,starts_at,venue,cover_image_url),ticket_types(name),bookings!inner(booking_number,user_id),booking_items(quantity)").eq("bookings.user_id",authUser.id).order("issued_at",{ascending:false}),
    supabase.from("notifications").select("id,title,message,type,is_read,created_at,booking_id").eq("user_id",authUser.id).order("created_at",{ascending:false}).limit(100)
   ]);
   if(!alive)return;
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
   .subscribe();
  return()=>{alive=false;void supabase.removeChannel(channel);};
 },[authUser]);
 useEffect(()=>{const saved=window.localStorage.getItem("haddir-theme");const prefersDark=window.matchMedia?.("(prefers-color-scheme: dark)").matches;setDarkMode(saved?saved==="dark":!!prefersDark);},[]);
 useEffect(()=>{document.documentElement.dataset.theme=darkMode?"dark":"light";document.documentElement.style.colorScheme=darkMode?"dark":"light";window.localStorage.setItem("haddir-theme",darkMode?"dark":"light");},[darkMode]);
 useEffect(()=>{const key="haddir-welcome-seen";if(!sessionStorage.getItem(key)){setShowWelcome(true);sessionStorage.setItem(key,"1");const timer=window.setTimeout(()=>setShowWelcome(false),3600);return()=>window.clearTimeout(timer);}},[]);
 useEffect(()=>{const supabase=getSupabaseBrowserClient();if(!supabase){setEventsError("إعدادات الاتصال بقاعدة البيانات غير مكتملة.");setEventsLoading(false);return;}let alive=true;const loadEvents=async()=>{setEventsLoading(true);setEventsError("");const {data,error}=await supabase.from("events").select("id,title,category,city,venue,starts_at,description,status,is_trending,cover_image_url,location_url").eq("status","published").order("starts_at",{ascending:true});if(error){console.error("Could not load events",error);if(alive){setEventsError(error.message||"تعذر تحميل الفعاليات.");setEventsLoading(false);}return;}if(!alive)return;const eventRows=data||[];const eventIds=eventRows.map((e:any)=>e.id);let ticketRows:any[]=[];if(eventIds.length){const {data:ticketData,error:ticketError}=await supabase.from("ticket_types").select("id,event_id,name,description,price,currency,quantity_total,quantity_sold,sales_start_at,sales_end_at,is_active").in("event_id",eventIds);if(ticketError){console.error("Could not load ticket types",ticketError);if(alive)setTicketTypesError("تعذر تحميل فئات وأسعار التذاكر من قاعدة البيانات. "+(ticketError.message||""));}else{ticketRows=ticketData||[];if(alive)setTicketTypesError("");}}if(!alive)return;const mapped=eventRows.map((e:any,index:number)=>{const now=Date.now();const tiers=ticketRows.filter((t:any)=>t.event_id===e.id&&t.is_active).map((t:any)=>{const total=Math.max(0,Number(t.quantity_total)||0),sold=Math.max(0,Number(t.quantity_sold)||0),available=Math.max(0,total-sold),starts=t.sales_start_at?new Date(t.sales_start_at).getTime():0,ends=t.sales_end_at?new Date(t.sales_end_at).getTime():Infinity;return {id:t.id,name:t.name,description:t.description||"",priceValue:Number(t.price),currency:String(t.currency||"SDG").trim(),price:Number(t.price)===0?"مجاناً":formatMoney(Number(t.price),String(t.currency||"SDG")),quantityTotal:total,quantitySold:sold,available,availableNow:available>0&&now>=starts&&now<=ends};});const eventEnded=new Date(e.starts_at).getTime()<=now;const status=eventEnded?"انتهت":tiers.length===0?"غير متاح":tiers.every((t:any)=>t.available<=0)?"تم البيع بالكامل":tiers.every((t:any)=>!t.availableNow)?"البيع غير متاح حالياً":"متوفر";return {id:e.id,date:formatEventDate(e.starts_at),title:e.title,place:e.city||"",category:e.category||"فعاليات",price:tiers[0]?.price||"—",cover:["cover-one","cover-two","cover-three"][index%3],coverImageUrl:e.cover_image_url||null,tag:e.category||"فعالية",time:new Intl.DateTimeFormat("ar-SD",{hour:"numeric",minute:"2-digit"}).format(new Date(e.starts_at)),venue:e.venue||e.city||"",status,map:e.location_url||"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent((e.venue||"")+" "+(e.city||"")),about:e.description||"تفاصيل الفعالية ستُضاف قريباً.",isTrending:!!e.is_trending,tiers};});setEvents(mapped);setEventsLoading(false);const params=new URLSearchParams(window.location.search);const requested=params.get("event");if(requested&&mapped.some(e=>e.id===requested)){setSelectedEvent(requested);const idx=Number(params.get("tier")||0);const ev=mapped.find(e=>e.id===requested);if(ev?.tiers[idx]){setSelectedTier(idx);setTierChosen(params.has("tier"));}setTicketCount(Math.min(5,Math.max(1,Number(params.get("qty")||1))));setShowPayment(params.get("checkout")==="1");}};void loadEvents();const channel=supabase.channel("public-events-live").on("postgres_changes",{event:"*",schema:"public",table:"events"},()=>{void loadEvents();}).on("postgres_changes",{event:"*",schema:"public",table:"ticket_types"},()=>{void loadEvents();}).subscribe();return()=>{alive=false;void supabase.removeChannel(channel);};},[]);
 useEffect(()=>{const supabase=getSupabaseBrowserClient();if(!supabase){setAuthMessage("تسجيل الدخول يحتاج إعداد مفاتيح Supabase في بيئة الموقع.");return;}let alive=true;const load=async(user:{id:string;email?:string;user_metadata?:Record<string,unknown>}|null)=>{if(!alive)return;setAuthUser(user as typeof authUser);if(user){const {data}=await supabase.from("profiles").select("role,full_name,phone").eq("id",user.id).maybeSingle();if(!alive)return;setUserRole(data?.role||"customer");const {data:assignmentRows}=await supabase.from("event_role_assignments").select("event_id,assignment_role,events(id,title,venue,city,starts_at,status)").eq("user_id",user.id).in("assignment_role",["gatekeeper","organizer","advertiser"]).limit(1);if(!alive)return;setAssignedEvent(assignmentRows?.[0]||null);const metadataName=String(user.user_metadata?.full_name||user.user_metadata?.name||"");const metadataAvatar=String(user.user_metadata?.avatar_url||user.user_metadata?.picture||"");setFullName(String(data?.full_name||metadataName||""));setPhone(String(data?.phone||""));setEmail(user.email||"");setAvatarUrl(metadataAvatar);setProfileEditing(false);setSaved(false);}else{setUserRole("customer");setAssignedEvent(null);setGatekeeperResult(null);setGatekeeperCode("");setFullName("");setEmail("");setPhone("");setAvatarUrl("");setProfileEditing(false);setSaved(false);setActiveWorkspace(null);}};supabase.auth.getSession().then(({data})=>load(data.session?.user??null));const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{void load(session?.user??null);});return()=>{alive=false;subscription.unsubscribe();};},[]);
 const gatekeeper = useGatekeeper({ authUser, assignedEvent, userRole, isGatekeeperPage, activeWorkspace });
 const {
  gatekeeperCode, setGatekeeperCode, gatekeeperResult, setGatekeeperResult,
  gatekeeperLoading, gatekeeperOnline, manualEntryOpen, setManualEntryOpen,
  gatekeeperCounts, gatekeeperHistory: gatekeeperManualHistory, gatekeeperHistoryLoading,
  scannerOpen, setScannerOpen, videoRef, runGatekeeperAction, openScanner, openManualEntry,
 } = gatekeeper;
 const openAdvertiserStats=async()=>{
  if(!authUser||userRole!=="advertiser")return;
  const supabase=getSupabaseBrowserClient();
  if(!supabase){setAdvertiserStatsError("تعذر الاتصال بقاعدة البيانات حالياً.");setShowAdvertiserStats(true);return;}
  setShowAdvertiserStats(true);setAdvertiserStatsLoading(true);setAdvertiserStatsError("");setAdvertiserStats(null);
  const {data,error}=await supabase.rpc("get_advertiser_event_statistics");
  setAdvertiserStatsLoading(false);
  if(error){setAdvertiserStatsError(error.message||"تعذر تحميل إحصائيات الفعالية.");return;}
  if(!data?.event){setAdvertiserStatsError("ما لقينا فعالية مرتبطة بحسابك.");return;}
  setAdvertiserStats(data);
 };
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
 const notificationKind=(type:string)=>{
  if(type==="ticket_approved"||type==="payment_rejected")return "booking";
  if(String(type||"").startsWith("event_reminder_"))return "event";
  return "system";
 };
 const selected=events.find(e=>e.id===selectedEvent);
 const booking=useBooking({authUser,selected:selected||null,selectedTier,ticketCount,onSuccess:()=>setActiveTab("notifications")});
 const {eventPaymentAccounts,paymentMethod,setPaymentMethod,receipt,setReceipt,bookingDone,bookingNumber,bookingError,setBookingError,bookingSubmitting,accountCopied,setAccountCopied,loadPaymentAccounts,copyAccount,submitBooking}=booking;
 const resetBooking=()=>{setSelectedEvent(null);setSelectedTier(0);setTierChosen(false);setShowPayment(false);setTicketCount(1);booking.resetBooking();};
 const go=(tab:Tab)=>{
  resetBooking();setActiveTab(tab);
  const url=new URL(window.location.href);
  if(tab==="home")url.searchParams.delete("tab");else url.searchParams.set("tab",tab);
  url.searchParams.delete("workspace");setIsGatekeeperPage(false);setActiveWorkspace(null);
  window.history.replaceState({}, "", url.pathname+url.search+url.hash);
  window.scrollTo({top:0,behavior:"smooth"});
 }; const downloadTicket=async(ticket:any)=>{try{const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext("2d");if(!ctx)return;await document.fonts.ready;ctx.fillStyle="#f7f1fb";ctx.fillRect(0,0,1080,1350);ctx.fillStyle="#fff";ctx.fillRect(48,48,984,1254);ctx.strokeStyle="#e7d9f1";ctx.lineWidth=3;ctx.strokeRect(48,48,984,1254);ctx.direction="rtl";ctx.textAlign="right";const right=950;ctx.fillStyle="#5b2e82";ctx.font="bold 48px Alexandria,Arial";ctx.fillText("حاضر  HADDIR",right,135);ctx.fillStyle="#8b7897";ctx.font="26px Alexandria,Arial";ctx.fillText("تذكرة دخول إلكترونية",right,190);ctx.strokeStyle="#dfd1e9";ctx.setLineDash([10,9]);ctx.beginPath();ctx.moveTo(100,230);ctx.lineTo(980,230);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="#8b7897";ctx.font="26px Alexandria,Arial";ctx.fillText("الفعالية",right,300);ctx.fillStyle="#30213b";ctx.font="bold 44px Alexandria,Arial";const eventTitle=String(ticket.events?.title||"فعالية");ctx.fillText(eventTitle.length>32?eventTitle.slice(0,32)+"…":eventTitle,right,365);ctx.fillStyle="#8b7897";ctx.font="24px Alexandria,Arial";ctx.fillText("نوع التذكرة",right,455);ctx.fillText("رقم الحجز",520,455);ctx.fillStyle="#3d3047";ctx.font="bold 27px Alexandria,Arial";ctx.fillText(String(ticket.ticket_types?.name||"تذكرة"),right,500);ctx.fillText(String(ticket.bookings?.booking_number||"—"),520,500);ctx.fillStyle="#8b7897";ctx.font="24px Alexandria,Arial";ctx.fillText("الموقع",right,575);ctx.fillText("التاريخ",520,575);ctx.fillStyle="#3d3047";ctx.font="bold 25px Alexandria,Arial";ctx.fillText(String(ticket.events?.venue||"—"),right,620);ctx.fillText(ticket.events?.starts_at?formatEventDate(ticket.events.starts_at):"—",520,620);ctx.strokeStyle="#e5d9ed";ctx.setLineDash([10,9]);ctx.beginPath();ctx.moveTo(100,675);ctx.lineTo(980,675);ctx.stroke();ctx.setLineDash([]);const qr=document.querySelector('[data-ticket-id="'+String(ticket.id)+'"] .haddir-ticket-qr svg');if(!qr)throw new Error("QR unavailable");const svg=new XMLSerializer().serializeToString(qr);const img=new Image();const loaded=new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error("QR image failed"));});img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);await loaded;ctx.drawImage(img,330,700,420,420);ctx.fillStyle="#8e8297";ctx.font="23px Alexandria,Arial";ctx.textAlign="center";ctx.fillText("امسح الرمز للتحقق من التذكرة",540,1045);ctx.fillStyle="#5c2e82";ctx.font="bold 48px Arial";ctx.fillText(String(ticket.ticket_code||""),540,1120);ctx.fillStyle="#f6f0fa";ctx.fillRect(48,1190,984,112);ctx.fillStyle="#76558d";ctx.font="bold 23px Alexandria,Arial";ctx.fillText("احتفظ بالتذكرة وأبرزها عند الدخول",540,1255);const link=document.createElement("a");link.download="haddir-ticket-"+String(ticket.ticket_code||ticket.id)+".png";link.href=canvas.toDataURL("image/png");link.click();}catch(error){console.error("Ticket image export failed",error);alert("تعذر حفظ التذكرة كصورة. حاول مرة أخرى.");}};
 const openEvent=(id:string)=>{resetBooking();const url=new URL(window.location.href);url.searchParams.set("event",id);url.searchParams.delete("checkout");url.searchParams.delete("tier");url.searchParams.delete("qty");window.history.pushState({...window.history.state,haddirPage:"event-detail"},"",url.pathname+url.search+url.hash);setSelectedEvent(id);window.scrollTo({top:0,behavior:"smooth"});};
 const openPayment=async()=>{if(!tierChosen)return;if(!authUser){setAuthMessage("سجّل الدخول أولاً عشان نكمل حجزك. الفعاليات متاحة للتصفح بدون حساب.");setSelectedEvent(null);setShowPayment(false);setActiveTab("profile");window.scrollTo({top:0,behavior:"smooth"});return;}setAuthMessage("");if(selected){const loaded=await loadPaymentAccounts(selected.id);if(!loaded)return;}const url=new URL(window.location.href);url.searchParams.set("checkout","1");url.searchParams.set("tier",String(selectedTier));url.searchParams.set("qty",String(ticketCount));window.history.pushState({...window.history.state,haddirPage:"event-payment"},"",url.pathname+url.search+url.hash);setShowPayment(true);window.scrollTo({top:0,behavior:"smooth"});};
 const backToDetails=()=>{if((window.history.state as {haddirPage?:string}|null)?.haddirPage==="event-payment"){window.history.back();return;}const url=new URL(window.location.href);url.searchParams.delete("checkout");window.history.replaceState({...window.history.state,haddirPage:"event-detail"},"",url.pathname+url.search+url.hash);setShowPayment(false);window.scrollTo({top:0,behavior:"smooth"});};

 return <main dir="rtl" lang="ar" className={"app-shell"+(darkMode?" theme-dark":"")}>
 <>
 {!selected&&(isGatekeeperPage?<header className="screen-topbar gatekeeper-page-topbar"><button type="button" className="btn btn-outline" onClick={()=>{setIsGatekeeperPage(false);setActiveWorkspace(null);const url=new URL(window.location.href);url.searchParams.delete("workspace");window.location.assign(url.pathname+url.search+url.hash);}}>العودة للملف الشخصي</button><strong>مسح التذاكر</strong><span className="screen-icon"><ScanLine/></span></header>:activeTab==="home"?<header className="topbar"><div className="container header-inner"><button className="brand brand-button" onClick={()=>go("home")}><span className="brand-mark">ح</span> حاضر</button><div className="desktop-greeting">من السودان، لكل لحظة تستاهل الحضور.</div><button className="header-icon theme-toggle" type="button" aria-label={darkMode?"تفعيل الوضع النهاري":"تفعيل الوضع الليلي"} aria-pressed={darkMode} onClick={()=>setDarkMode(v=>!v)}>{<span className="theme-toggle-track" aria-hidden="true"><span className="theme-toggle-knob">{darkMode?"☾":"☀"}</span></span>}</button></div></header>:<header className="screen-topbar"><span className="screen-topbar-spacer" aria-hidden="true"/><strong>{({tickets:"تذاكري",notifications:"الإشعارات",profile:"الملف الشخصي"} as Record<string,string>)[activeTab]}</strong><span className="screen-icon">{activeTab==="tickets"?<Ticket/>:activeTab==="notifications"?<Bell/>:<UserRound/>}</span></header>)}
 <div className="app-content">
 {!isGatekeeperPage&&activeTab==="home"&&<>
 {showWelcome&&<div className="welcome-motion" role="status"><span className="welcome-spark"><Sparkles size={19}/></span><div><strong>أهلاً بيك في حاضر</strong><p>لحظاتك الحلوة بتبدأ من هنا</p></div><span className="welcome-orbit">✦</span></div>}
 <section className="home-discovery redesigned-home" id="events"><div className="container">
  {eventsLoading?<div className="empty-state"><strong>جاري تحميل الفعاليات...</strong></div>:eventsError?<div className="empty-state" role="alert"><strong>ما قدرنا نحمّل الفعاليات</strong><p>{eventsError}</p><button className="btn btn-outline" onClick={()=>window.location.reload()}>إعادة المحاولة</button></div>:<>
   <section className="trending-section">
    <div className="redesign-section-head"><div className="redesign-title"><h2>رائج الآن</h2><span className="trending-dot" aria-hidden="true"/></div></div>
    {events.some(e=>e.isTrending)?<div ref={trendingCarouselRef} className="trending-carousel hide-scrollbar" dir="ltr" onMouseEnter={()=>setTrendingPaused(true)} onMouseLeave={()=>setTrendingPaused(false)} onTouchStart={()=>setTrendingPaused(true)} onTouchEnd={()=>setTrendingPaused(false)} onTouchCancel={()=>setTrendingPaused(false)}>{trendingLoopEvents.map((e,index)=><article className="trending-card snap-item" key={e.id+"-loop-"+index} role="button" tabIndex={index>=trendingEvents.length?-1:0} aria-hidden={index>=trendingEvents.length} aria-label={"عرض تفاصيل "+e.title} onClick={()=>openEvent(e.id)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openEvent(e.id);}}}><div className={"trending-card-media "+e.cover}>{e.coverImageUrl?<img src={e.coverImageUrl} alt={index>=trendingEvents.length?"":e.title} loading="lazy"/>:<span className="trending-placeholder">✦</span>}<div className="trending-overlay"/><span className="trending-category">{e.category}</span><span className="trending-price">{e.price}</span><div className="trending-card-copy"><h3>{e.title}</h3><div><CalendarDays size={14}/><span>{e.date} · {e.time}</span></div><div><MapPin size={14}/><span>{e.venue||e.place}</span></div></div></div></article>)}</div>:<div className="empty-state">ما في فعاليات رائجة حالياً.</div>}
   </section>
   <section className="more-events redesigned-more">
    <div className="redesign-section-head"><h2>فعاليات أخرى</h2><span>{events.filter(e=>!e.isTrending).length} فعاليات</span></div>
    {events.some(e=>!e.isTrending)?<div className="event-list">{events.filter(e=>!e.isTrending).map(e=><article className="event-list-card event-card-clickable" key={e.id} role="button" tabIndex={0} aria-label={"عرض تفاصيل "+e.title} onClick={()=>openEvent(e.id)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openEvent(e.id);}}}><div className={"event-list-thumb "+e.cover}>{e.coverImageUrl?<img src={e.coverImageUrl} alt={e.title} loading="lazy"/>:<span>✦</span>}</div><div className="event-list-info"><h3>{e.title}</h3><div className="event-list-top"><span>{e.category}</span><strong>{e.price}</strong></div><p><CalendarDays size={13}/>{e.date} · {e.time}</p><p><MapPin size={13}/>{e.venue||e.place}</p></div></article>)}</div>:<div className="empty-state">ما في فعاليات أخرى حالياً.</div>}
   </section>
  </>}
 </div></section>
 </>}
 {!isGatekeeperPage&&activeTab==="tickets"&&<section className="screen container tickets-screen">{accountDataLoading?<div className="empty-state">جاري تحميل تذاكرك...</div>:accountDataError?<div className="empty-state" role="alert">{accountDataError}</div>:<>
   <div className="ticket-tabs" role="tablist" aria-label="حالة التذاكر">
    <button type="button" role="tab" aria-selected={ticketFilter==="new"} className={ticketFilter==="new"?"active":""} onClick={()=>{setTicketFilter("new");setExpandedTicketId(null);}}>تذاكر جديدة <span>{myTickets.filter((t:any)=>t.status==="valid").length}</span></button>
    <button type="button" role="tab" aria-selected={ticketFilter==="used"} className={ticketFilter==="used"?"active":""} onClick={()=>{setTicketFilter("used");setExpandedTicketId(null);}}>تذاكر مستخدمة <span>{myTickets.filter((t:any)=>t.status==="used").length}</span></button>
   </div>
   {(()=>{const visibleTickets=myTickets.filter((t:any)=>t.status===(ticketFilter==="new"?"valid":"used"));return visibleTickets.length===0?<div className="empty-state"><Ticket size={28}/><strong>{ticketFilter==="new"?"ما عندك تذاكر جديدة حالياً":"ما عندك تذاكر مستخدمة حالياً"}</strong><p>{ticketFilter==="new"?"بعد قبول إثبات الدفع، حتظهر تذاكرك هنا.":"التذاكر التي يتم تأكيد دخولها عند البوابة حتظهر هنا."}</p></div>:<div className="ticket-list">{visibleTickets.map((ticket:any)=><div className="ticket-card-wrap" key={ticket.id} data-ticket-id={ticket.id}>
    <button type="button" className="ticket-preview-card" aria-expanded={expandedTicketId===ticket.id} onClick={()=>setExpandedTicketId(current=>current===ticket.id?null:ticket.id)}>
     <span className="ticket-preview-image">{ticket.events?.cover_image_url?<img src={ticket.events.cover_image_url} alt={ticket.events?.title||"صورة الفعالية"} loading="lazy"/>:<span className="ticket-preview-fallback"><Ticket size={25}/></span>}</span>
     <span className="ticket-preview-copy"><strong>{ticket.events?.title||"فعالية"}</strong><span><CalendarDays size={13}/>{ticket.events?.starts_at?formatEventDate(ticket.events.starts_at):"التاريخ غير محدد"}</span><span><UserRound size={13}/>عدد الأشخاص: {ticket.booking_items?.quantity||1}</span></span>
     <span className={"ticket-preview-status "+(ticket.status==="used"?"used":"")}>{ticket.status==="used"?"مستخدمة":"جديدة"}</span>
    </button>
    {expandedTicketId===ticket.id&&<div className="ticket-expanded-panel">
     <article className="haddir-ticket"><div className="haddir-ticket-head"><strong>حاضر <span>HADDIR</span></strong><span className="ticket-confirmed">{ticket.status==="valid"?"تذكرة صالحة":ticket.status==="used"?"تم استخدامها":ticket.status}</span></div>
      <div className="haddir-ticket-event"><small>تذكرة دخول</small><h2>{ticket.events?.title||"فعالية"}</h2></div>
      <div className="haddir-ticket-meta"><div><small>نوع التذكرة</small><strong>{ticket.ticket_types?.name||"تذكرة"}</strong></div><div><small>رقم الحجز</small><strong>{ticket.bookings?.booking_number||"—"}</strong></div><div><small>الموقع</small><strong>{ticket.events?.venue||"—"}</strong></div><div><small>التاريخ</small><strong>{ticket.events?.starts_at?formatEventDate(ticket.events.starts_at):"—"}</strong></div><div><small>عدد الأشخاص</small><strong>{ticket.booking_items?.quantity||1} أشخاص</strong></div></div>
      <div className="haddir-ticket-qr"><QrCodeSVG value={ticket.ticket_code} size={220} level="H" includeMargin/><small>امسح الرمز للتحقق من التذكرة، أو أدخل الكود يدوياً عند البوابة</small></div>
      <div className="haddir-ticket-code"><small>كود الدخول · 10 أرقام</small><strong dir="ltr">{ticket.ticket_code}</strong></div><div className="haddir-ticket-footer">احتفظ بتذكرتك وأبرزها عند الدخول</div>
     </article>
     <button className="btn btn-outline pay-button" type="button" onClick={()=>void downloadTicket(ticket)}><Download size={17}/> حفظ التذكرة كصورة</button>
    </div>}
   </div>)}</div>})()}
  </>}</section>}
 {!isGatekeeperPage&&activeTab==="notifications"&&<section className="screen container notifications-screen">
  {accountDataLoading?<div className="empty-state">جاري تحميل الإشعارات...</div>:accountDataError?<div className="empty-state" role="alert">{accountDataError}</div>:<>
   <div className="notifications-toolbar">
    <div><strong>إشعاراتك</strong><small>{unreadNotificationCount} غير مقروء</small></div>
    <button type="button" className="notification-mark-all" onClick={()=>void markAllNotificationsRead()} disabled={!unreadNotificationCount}>تعليم الكل كمقروء</button>
   </div>
   <div className="notification-filters" role="tablist" aria-label="تصفية الإشعارات">
    <button type="button" className={notificationFilter==="all"?"active":""} onClick={()=>setNotificationFilter("all")}>الكل <span>{myNotifications.length}</span></button>
    <button type="button" className={notificationFilter==="unread"?"active":""} onClick={()=>setNotificationFilter("unread")}>غير مقروءة <span>{unreadNotificationCount}</span></button>
    <button type="button" className={notificationFilter==="read"?"active":""} onClick={()=>setNotificationFilter("read")}>مقروءة</button>
   </div>
   {filteredNotifications.length===0?<div className="empty-state"><Bell size={26}/><strong>{myNotifications.length===0?"ما عندك إشعارات حالياً":notificationFilter==="unread"?"ما عندك إشعارات غير مقروءة":"ما عندك إشعارات مقروءة"}</strong><p>حتظهر هنا تحديثات حجوزاتك والفعاليات ونظام حاضر.</p></div>:<div className="notification-list">{filteredNotifications.map((notification:any)=>{const kind=notificationKind(notification.type);return <article key={notification.id} className={`notification-item ${notification.is_read?"is-read":"is-unread"}`}><button type="button" className="notification-open" onClick={()=>void openNotification(notification)} aria-label={`فتح الإشعار: ${notification.title}`}><span className={`notification-icon ${kind}`}>{kind==="booking"?(notification.type==="ticket_approved"?<CheckCircle2 size={19}/>:<Bell size={19}/>):kind==="event"?<CalendarDays size={19}/>:<Sparkles size={19}/>}</span><span className="notification-copy"><strong>{notification.title}</strong><p>{notification.message}</p><small>{new Date(notification.created_at).toLocaleString("ar-SD")}</small></span><span className="notification-state">{notification.is_read?"مقروء":"جديد"}</span></button><button type="button" className="notification-toggle-read" onClick={()=>void markNotificationRead(notification,!notification.is_read)}>{notification.is_read?"تحديد كغير مقروء":"تحديد كمقروء"}</button></article>})}</div>}
  </>}
 </section>}
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
  {userRole==="advertiser"&&<button type="button" className="role-workspace-button" onClick={()=>void openAdvertiserStats()}><span className="role-workspace-icon"><Ticket size={21}/></span><span><strong>تفاصيل الفعالية</strong><small>عرض المبيعات والتذاكر والمستحقات للفعالية المرتبطة بك</small></span><ChevronLeft size={18}/></button>}

 </section>}
 {authUser&&userRole==="advertiser"&&<section className="detail-section advertiser-profile-stats">
  
  {showAdvertiserStats&&<div className="advertiser-statistics-panel">
   <div className="advertiser-stats-heading"><div><small>لوحة المعلن</small><h2>إحصائيات فعاليتك</h2></div><button type="button" className="btn btn-outline" onClick={()=>setShowAdvertiserStats(false)}>إغلاق</button></div>
   {advertiserStatsLoading?<div className="empty-state">جاري تحميل الإحصائيات...</div>:advertiserStatsError?<div className="empty-state" role="alert">{advertiserStatsError}</div>:advertiserStats&&<>
    <article className="advertiser-event-summary"><small>الفعالية المرتبطة بحسابك فقط</small><h3>{advertiserStats.event.title}</h3><p>{advertiserStats.event.venue||advertiserStats.event.city||"الموقع غير محدد"} · {advertiserStats.event.starts_at?formatEventDate(advertiserStats.event.starts_at):"—"}</p></article>
    <div className="advertiser-metric-grid">
     <article><small>الحاجزون المعتمدون</small><strong>{Number(advertiserStats.totals?.bookers||0).toLocaleString("ar-SD")}</strong></article>
     <article><small>الحجوزات المؤكدة</small><strong>{Number(advertiserStats.totals?.confirmed_bookings||0).toLocaleString("ar-SD")}</strong></article>
     <article><small>الحجوزات المرفوضة</small><strong>{Number(advertiserStats.totals?.rejected_bookings||0).toLocaleString("ar-SD")}</strong></article>
     <article><small>التذاكر المباعة</small><strong>{Number(advertiserStats.totals?.confirmed_tickets||0).toLocaleString("ar-SD")}</strong></article>
     <article><small>التذاكر ضمن طلبات مرفوضة</small><strong>{Number(advertiserStats.totals?.rejected_tickets||0).toLocaleString("ar-SD")}</strong></article>
    </div>
    <h3 className="advertiser-stats-subtitle">ملخص المبيعات والمستحقات</h3>
    {(advertiserStats.financials||[]).length?advertiserStats.financials.map((line:any)=><article className="advertiser-finance-card" key={line.currency}>
     <div><small>إجمالي المبيعات المعتمدة</small><strong>{formatMoney(Number(line.sales||0),line.currency)}</strong></div>
     {Number(advertiserStats.event.platform_fee_percent||0)>0&&<div><small>عمولة حاضر ({Number(advertiserStats.event.platform_fee_percent)}%)</small><strong>{formatMoney(Number(line.platform_fee||0),line.currency)}</strong></div>}
     <div className="advertiser-net"><small>صافي مستحقات المعلن</small><strong>{formatMoney(Number(line.advertiser_net||0),line.currency)}</strong></div>
    </article>):<article className="advertiser-finance-card"><div><small>إجمالي المبيعات المعتمدة</small><strong>{formatMoney(0)}</strong></div>{Number(advertiserStats.event.platform_fee_percent||0)>0&&<div><small>عمولة حاضر ({Number(advertiserStats.event.platform_fee_percent)}%)</small><strong>{formatMoney(0)}</strong></div>}<div className="advertiser-net"><small>صافي مستحقات المعلن</small><strong>{formatMoney(0)}</strong></div></article>}
    <h3 className="advertiser-stats-subtitle">تفاصيل فئات التذاكر</h3>
    <div className="advertiser-ticket-table"><table><thead><tr><th>الفئة</th><th>السعة</th><th>المباع</th><th>المرفوض</th><th>المتبقي</th><th>المبيعات</th></tr></thead><tbody>{(advertiserStats.ticket_types||[]).map((ticket:any)=><tr key={ticket.id}><td>{ticket.name}</td><td>{Number(ticket.quantity_total||0).toLocaleString("ar-SD")}</td><td>{Number(ticket.confirmed_quantity||0).toLocaleString("ar-SD")}</td><td>{Number(ticket.rejected_quantity||0).toLocaleString("ar-SD")}</td><td>{Number(ticket.remaining_quantity||0).toLocaleString("ar-SD")}</td><td>{formatMoney(Number(ticket.sales||0),ticket.currency)}</td></tr>)}</tbody></table></div>
    <p className="advertiser-stats-note">المبيعات محسوبة من الحجوزات المؤكدة فقط. صافي المستحقات يساوي المبيعات بعد خصم عمولة حاضر، ولا يشمل مصروفات تشغيلية أو تسويات خارج المنصة.</p>
   </>}
  </div>}
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
 {selected&&<section className="event-detail-page" aria-label={"تفاصيل "+selected.title}>
 {!showPayment?<div className="detail-sheet event-detail-layout" aria-label={"تفاصيل "+selected.title}>
  <div className={"detail-cover event-cover "+selected.cover}>
   {selected.coverImageUrl&&<img className="event-cover-image" src={selected.coverImageUrl} alt={selected.title}/>}
   <div className="detail-cover-shade"/>
   <div className="detail-cover-controls">
    <button className="detail-glass-button" aria-label="إغلاق التفاصيل" onClick={()=>{if((window.history.state as {haddirPage?:string}|null)?.haddirPage==="event-detail"||(window.history.state as {haddirPage?:string}|null)?.haddirPage==="event-payment"){window.history.back();}else{setSelectedEvent(null);setShowPayment(false);}}}><ArrowLeft size={20}/></button>
    <div className="detail-cover-actions"><span className="detail-category-badge">{selected.category||"فعالية"}</span><button className="detail-glass-button" aria-label="مشاركة الفعالية" onClick={async()=>{const eventUrl=new URL(window.location.pathname,window.location.origin);eventUrl.searchParams.set("event",String(selected.id));try{if(navigator.share)await navigator.share({title:selected.title,text:"شوف الفعالية دي على حاضر",url:eventUrl.toString()});else{await navigator.clipboard.writeText(eventUrl.toString());alert("تم نسخ رابط الفعالية");}}catch(error){if(error instanceof Error&&error.name!=="AbortError")alert("تعذر مشاركة الفعالية حالياً.");}}}><Share2 size={18}/></button></div>
   </div>
   <div className="detail-cover-title"><span>تجربة تستحق الحضور</span><h1>{selected.title}</h1></div>
   {!selected.coverImageUrl&&<span className="cover-symbol">✦</span>}
  </div>
  <div className="detail-content">
   <div className="detail-main">
    <section className="detail-quick-info" aria-label="معلومات الفعالية">
     <div className="quick-info-row"><span className="quick-info-icon calendar-icon"><CalendarDays size={21}/></span><div><small>التاريخ والوقت</small><strong>{selected.date}</strong><span>{selected.time||"يحدد لاحقاً"}</span></div></div>
     <div className="quick-info-divider"/>
     <a className="quick-info-row quick-location-row" href={selected.map||"#"} target="_blank" rel="noreferrer"><span className="quick-info-icon location-icon"><MapPin size={21}/></span><div><small>المكان والموقع</small><strong>{selected.venue||selected.place||"يحدد لاحقاً"}</strong><span>{selected.place||"عرض الاتجاهات على الخريطة"} · اضغط لعرض الموقع</span></div><ExternalLink size={16}/></a>
    </section>
    <section className="detail-section detail-about"><h2>عن الفعالية</h2><p>{selected.about||"تفاصيل الفعالية ستُضاف قريباً."}</p></section>
    <section className="detail-section detail-ticket-section">
     <div className="tier-heading"><h2>فئات التذاكر</h2><span>اختر فئة للمتابعة</span></div>
     {ticketTypesError?<div className="empty-state" role="alert"><strong>تعذر تحميل فئات التذاكر</strong><p>{ticketTypesError}</p><button className="btn btn-outline" onClick={()=>window.location.reload()}>إعادة المحاولة</button></div>:(selected.tiers||[]).length?<div className="tier-list">{selected.tiers.map((tier,index)=><button type="button" key={tier.name} className={"tier-card "+(selectedTier===index&&tierChosen?"tier-selected":"")} aria-pressed={selectedTier===index&&tierChosen} disabled={!tier.availableNow||tier.available<=0} onClick={()=>{setSelectedTier(index);setTierChosen(true);setTicketCount(1);const url=new URL(window.location.href);url.searchParams.set("tier",String(index));url.searchParams.set("qty","1");window.history.replaceState({...window.history.state,haddirPage:"event-detail"},"",url.pathname+url.search+url.hash);}}><span className="tier-radio">{selectedTier===index&&tierChosen?<CheckCircle2 size={17}/>:null}</span><span className="tier-copy"><strong className="tier-name">{tier.name}</strong>{tier.description&&<small>{tier.description}</small>}</span><strong className="tier-price">{tier.price}</strong><small className="tier-availability">{tier.availableNow?`متبقي ${tier.available} تذكرة`:tier.available<=0?"نفدت التذاكر":"البيع غير متاح حالياً"}</small></button>)}</div>:<div className="empty-state">لم تُضف فئات تذاكر لهذه الفعالية بعد.</div>}
    </section>
    {tierChosen&&<section className="detail-quantity quantity-reveal"><div className="quantity-heading"><h3>عدد التذاكر</h3><span>المتاح: {Math.min(5,selected.tiers[selectedTier].available)} تذاكر</span></div><div className="quantity-control"><button type="button" aria-label="تقليل عدد التذاكر" disabled={ticketCount<=1} onClick={()=>setTicketCount(n=>{const next=Math.max(1,n-1);const url=new URL(window.location.href);url.searchParams.set("qty",String(next));window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);return next;})}>−</button><strong>{ticketCount}</strong><button type="button" aria-label="زيادة عدد التذاكر" disabled={ticketCount>=Math.min(5,selected.tiers[selectedTier].available)} onClick={()=>setTicketCount(n=>{const next=Math.min(5,n+1);const url=new URL(window.location.href);url.searchParams.set("qty",String(next));window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);return next;})}>+</button></div></section>}
    {tierChosen&&<div className="detail-booking-dock actionable-footer"><div className="detail-dock-summary"><small>المبلغ الإجمالي <span className="ticket-count-badge">{ticketCount} تذاكر</span></small><strong>{selected.tiers[selectedTier].price==="مجاناً"?"مجاناً":formatMoney(selected.tiers[selectedTier].priceValue*ticketCount,selected.tiers[selectedTier].currency)}</strong><span>{selected.tiers[selectedTier].name}</span></div><button className="btn btn-primary pay-button" disabled={!selected.tiers[selectedTier]?.availableNow||selected.tiers[selectedTier]?.available<ticketCount||["تم البيع بالكامل","انتهت","غير متاح","البيع غير متاح حالياً"].includes(selected.status)} onClick={openPayment}>ادفع الآن <ArrowLeft size={18}/></button></div>}
   </div>
  </div>
 </div>:<div className="detail-sheet event-detail-layout payment-sheet">
    <div className="checkout-topbar">
     <div className="checkout-back-group"><button type="button" className="detail-glass-button checkout-back-icon" aria-label="العودة للتفاصيل" onClick={backToDetails}><ArrowLeft size={20}/></button><span>العودة للتفاصيل</span></div>
     <span className="checkout-wallet-icon" aria-label="المحفظة"><Wallet size={23}/></span>
    </div>
    <div className="payment-screen">
     <div className="booking-steps" aria-label="خطوات الحجز"><span className="step-done">١. اختيار الفئة</span><span className="step-done">٢. مراجعة الحجز</span><span className="step-current">٣. الدفع</span></div>
     {!bookingDone
      ? <PaymentCheckout
          event={selected}
          selectedTier={selectedTier}
          ticketCount={ticketCount}
          totalLabel={selected.tiers[selectedTier].price==="مجاناً"?"مجاناً":formatMoney(selected.tiers[selectedTier].priceValue*ticketCount,selected.tiers[selectedTier].currency)}
          accounts={eventPaymentAccounts}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={(value)=>{setPaymentMethod(value);setAccountCopied(false);setBookingError("");}}
          accountCopied={accountCopied}
          onCopyAccount={copyAccount}
          receipt={receipt}
          onReceiptChange={setReceipt}
          bookingError={bookingError}
          bookingSubmitting={bookingSubmitting}
          onSubmit={submitBooking}
        />
      : <BookingSuccess
          bookingNumber={bookingNumber}
          eventTitle={selected.title}
          ticketCount={ticketCount}
          totalLabel={selected.tiers[selectedTier].price==="مجاناً"?"مجاناً":formatMoney(selected.tiers[selectedTier].priceValue*ticketCount)}
          onGoNotifications={()=>{resetBooking();setActiveTab("notifications");}}
        />
     }
    </div>
   </div>
 </section>}
 {!isGatekeeperPage&&!selected&&<nav className="bottom-nav" aria-label="التنقل الرئيسي"><button className={activeTab==="home"?"selected":""} onClick={()=>go("home")}><House size={21}/><span>الرئيسية</span></button><button className={activeTab==="tickets"?"selected":""} onClick={()=>go("tickets")}><Ticket size={21}/><span>تذاكري</span></button><button className={activeTab==="notifications"?"selected":""} onClick={()=>go("notifications")}><Bell size={21}/><span>الإشعارات</span></button><button className={activeTab==="profile"?"selected":""} onClick={()=>go("profile")}><UserRound size={21}/><span>حسابي</span></button></nav>}
 </>
 
 </main>;
}