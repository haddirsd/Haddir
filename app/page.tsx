"use client";
import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";
import { QRCodeSVG as QrCodeSVG } from "qrcode.react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { ArrowLeft, Bell, CalendarDays, CheckCircle2, House, MapPin, Settings, Sparkles, Ticket, UserRound, ChevronLeft, Share2, ExternalLink, CreditCard, Download, ScanLine, ShieldCheck, ClipboardList } from "lucide-react";
type EventItem = {id:string;date:string;title:string;place:string;category:string;price:string;cover:string;coverImageUrl:string|null;tag:string;time:string;venue:string;status:string;map:string;about:string;isTrending:boolean;tiers:{id:string;name:string;description:string;price:string;priceValue:number;currency:string;quantityTotal:number;quantitySold:number;available:number;availableNow:boolean}[]};
const formatEventDate=(value:string)=>new Intl.DateTimeFormat("ar-SD",{weekday:"long",day:"numeric",month:"long"}).format(new Date(value));

type EventPaymentAccount={id:string;account_name:string;account_number:string;beneficiary:string};
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
 const [ticketCount,setTicketCount]=useState(1),[eventPaymentAccounts,setEventPaymentAccounts]=useState<EventPaymentAccount[]>([]),[paymentMethod,setPaymentMethod]=useState(""),[receipt,setReceipt]=useState<File|null>(null),[bookingDone,setBookingDone]=useState(false),[bookingId,setBookingId]=useState<string|null>(null),[bookingNumber,setBookingNumber]=useState(""),[bookingError,setBookingError]=useState(""),[bookingSubmitting,setBookingSubmitting]=useState(false);
 const [showWelcome,setShowWelcome]=useState(false);
 const [showAdvertiserStats,setShowAdvertiserStats]=useState(false);
 const [assignedEvent,setAssignedEvent]=useState<any|null>(null);
 const [gatekeeperCode,setGatekeeperCode]=useState("");
 const [gatekeeperResult,setGatekeeperResult]=useState<any|null>(null);
 const [gatekeeperLoading,setGatekeeperLoading]=useState(false);
 const [gatekeeperOnline,setGatekeeperOnline]=useState(true);
 const [manualEntryOpen,setManualEntryOpen]=useState(false);
 const [gatekeeperCounts,setGatekeeperCounts]=useState({accepted:0,used:0,forged:0});
 const [gatekeeperManualHistory,setGatekeeperManualHistory]=useState<any[]>([]),[gatekeeperHistoryLoading,setGatekeeperHistoryLoading]=useState(false);
 const [scannerOpen,setScannerOpen]=useState(false);
 const videoRef=useRef<HTMLVideoElement|null>(null);
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
  useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const tab=params.get("tab");
  if(tab==="tickets"||tab==="notifications"||tab==="profile")setActiveTab(tab);
  if(params.get("workspace")==="gatekeeper"){setActiveWorkspace("gatekeeper");setIsGatekeeperPage(true);}
 },[]);
 useEffect(()=>{
  if(!authUser||!assignedEvent?.event_id||(userRole!=="gatekeeper"&&userRole!=="organizer"))return;
  let alive=true;
  const loadGatekeeperCounts=async()=>{
   const supabase=getSupabaseBrowserClient();if(!supabase)return;
   const {data,error}=await supabase.rpc("get_gatekeeper_scan_stats",{p_event_id:assignedEvent.event_id});
   if(alive&&!error&&data)setGatekeeperCounts({accepted:Number(data.accepted||0),used:Number(data.used||0),forged:Number(data.forged||0)});
  };
  void loadGatekeeperCounts();
  return()=>{alive=false;};
 },[authUser,assignedEvent?.event_id,userRole]);

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
 useEffect(()=>{const supabase=getSupabaseBrowserClient();if(!supabase){setEventsError("إعدادات الاتصال بقاعدة البيانات غير مكتملة.");setEventsLoading(false);return;}let alive=true;const loadEvents=async()=>{setEventsLoading(true);setEventsError("");const {data,error}=await supabase.from("events").select("id,title,category,city,venue,starts_at,description,status,is_trending,cover_image_url,location_url").eq("status","published").order("starts_at",{ascending:true});if(error){console.error("Could not load events",error);if(alive){setEventsError(error.message||"تعذر تحميل الفعاليات.");setEventsLoading(false);}return;}if(!alive)return;const eventRows=data||[];const eventIds=eventRows.map((e:any)=>e.id);let ticketRows:any[]=[];if(eventIds.length){const {data:ticketData,error:ticketError}=await supabase.from("ticket_types").select("id,event_id,name,description,price,currency,quantity_total,quantity_sold,sales_start_at,sales_end_at,is_active").in("event_id",eventIds);if(ticketError){console.error("Could not load ticket types",ticketError);if(alive)setTicketTypesError("تعذر تحميل فئات وأسعار التذاكر من قاعدة البيانات. "+(ticketError.message||""));}else{ticketRows=ticketData||[];if(alive)setTicketTypesError("");}}if(!alive)return;const mapped=eventRows.map((e:any,index:number)=>{const now=Date.now();const tiers=ticketRows.filter((t:any)=>t.event_id===e.id&&t.is_active).map((t:any)=>{const total=Math.max(0,Number(t.quantity_total)||0),sold=Math.max(0,Number(t.quantity_sold)||0),available=Math.max(0,total-sold),starts=t.sales_start_at?new Date(t.sales_start_at).getTime():0,ends=t.sales_end_at?new Date(t.sales_end_at).getTime():Infinity;return {id:t.id,name:t.name,description:t.description||"",priceValue:Number(t.price),currency:String(t.currency||"SDG").trim(),price:Number(t.price)===0?"مجاناً":formatMoney(Number(t.price),String(t.currency||"SDG")),quantityTotal:total,quantitySold:sold,available,availableNow:available>0&&now>=starts&&now<=ends};});const eventEnded=new Date(e.starts_at).getTime()<=now;const status=eventEnded?"انتهت":tiers.length===0?"غير متاح":tiers.every((t:any)=>t.available<=0)?"تم البيع بالكامل":tiers.every((t:any)=>!t.availableNow)?"البيع غير متاح حالياً":"متوفر";return {id:e.id,date:formatEventDate(e.starts_at),title:e.title,place:e.city||"",category:e.category||"فعاليات",price:tiers[0]?.price||"—",cover:["cover-one","cover-two","cover-three"][index%3],coverImageUrl:e.cover_image_url||null,tag:e.category||"فعالية",time:new Intl.DateTimeFormat("ar-SD",{hour:"numeric",minute:"2-digit"}).format(new Date(e.starts_at)),venue:e.venue||e.city||"",status,map:e.location_url||"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent((e.venue||"")+" "+(e.city||"")),about:e.description||"تفاصيل الفعالية ستُضاف قريباً.",isTrending:!!e.is_trending,tiers};});setEvents(mapped);setEventsLoading(false);const requested=new URLSearchParams(window.location.search).get("event");if(requested&&mapped.some(e=>e.id===requested))setSelectedEvent(requested);};void loadEvents();const channel=supabase.channel("public-events-live").on("postgres_changes",{event:"*",schema:"public",table:"events"},()=>{void loadEvents();}).on("postgres_changes",{event:"*",schema:"public",table:"ticket_types"},()=>{void loadEvents();}).subscribe();return()=>{alive=false;void supabase.removeChannel(channel);};},[]);
 useEffect(()=>{const supabase=getSupabaseBrowserClient();if(!supabase){setAuthMessage("تسجيل الدخول يحتاج إعداد مفاتيح Supabase في بيئة الموقع.");return;}let alive=true;const load=async(user:{id:string;email?:string;user_metadata?:Record<string,unknown>}|null)=>{if(!alive)return;setAuthUser(user as typeof authUser);if(user){const {data}=await supabase.from("profiles").select("role,full_name,phone").eq("id",user.id).maybeSingle();if(!alive)return;setUserRole(data?.role||"customer");const {data:assignmentRows}=await supabase.from("event_role_assignments").select("event_id,assignment_role,events(id,title,venue,city,starts_at,status)").eq("user_id",user.id).in("assignment_role",["gatekeeper","organizer","advertiser"]).limit(1);if(!alive)return;setAssignedEvent(assignmentRows?.[0]||null);const metadataName=String(user.user_metadata?.full_name||user.user_metadata?.name||"");const metadataAvatar=String(user.user_metadata?.avatar_url||user.user_metadata?.picture||"");setFullName(String(data?.full_name||metadataName||""));setPhone(String(data?.phone||""));setEmail(user.email||"");setAvatarUrl(metadataAvatar);setProfileEditing(false);setSaved(false);}else{setUserRole("customer");setAssignedEvent(null);setGatekeeperResult(null);setGatekeeperCode("");setFullName("");setEmail("");setPhone("");setAvatarUrl("");setProfileEditing(false);setSaved(false);setActiveWorkspace(null);}};supabase.auth.getSession().then(({data})=>load(data.session?.user??null));const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{void load(session?.user??null);});return()=>{alive=false;subscription.unsubscribe();};},[]);
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
 const loadGatekeeperManualHistory=async()=>{
  if(!assignedEvent?.event_id)return;
  const supabase=getSupabaseBrowserClient();if(!supabase)return;
  setGatekeeperHistoryLoading(true);
  const {data,error}=await supabase.rpc("get_gatekeeper_manual_history",{p_event_id:assignedEvent.event_id});
  setGatekeeperHistoryLoading(false);
  if(!error&&Array.isArray(data))setGatekeeperManualHistory(data);
 };
 const runGatekeeperAction=async(confirm:boolean,codeOverride?:string,entryMethod:"qr"|"manual"="qr")=>{
  const code=(codeOverride??gatekeeperCode).trim();
  if(!authUser||!assignedEvent||!code)return;
  if(entryMethod==="manual"&&!/^[0-9]{10}$/.test(code)){
   setGatekeeperResult({ok:false,status:"error",message:"كود التذكرة يجب أن يتكون من 10 أرقام فقط."});return;
  }
  const supabase=getSupabaseBrowserClient();if(!supabase)return;
  setGatekeeperLoading(true);
  const {data,error}=await supabase.rpc(entryMethod==="manual"?"gatekeeper_manual_ticket_action":"gatekeeper_ticket_action",{p_ticket_code:code,p_confirm:confirm});
  setGatekeeperLoading(false);
  if(error){setGatekeeperResult({ok:false,status:"error",message:error.message||"تعذر التحقق من التذكرة."});}
  else setGatekeeperResult(data);
  if(assignedEvent?.event_id){
   const {data:stats}=await supabase.rpc("get_gatekeeper_scan_stats",{p_event_id:assignedEvent.event_id});
   if(stats)setGatekeeperCounts({accepted:Number(stats.accepted||0),used:Number(stats.used||0),forged:Number(stats.forged||0)});
  }
  if(entryMethod==="manual")await loadGatekeeperManualHistory();
 };
 useEffect(()=>{
  const supabase=getSupabaseBrowserClient();
  if(!isGatekeeperPage||!authUser||!assignedEvent?.event_id||(userRole!=="gatekeeper"&&userRole!=="organizer")||!supabase)return;
  let alive=true;
  const refreshGatekeeperData=async()=>{
   const [{data:stats},{data:history,error}]=await Promise.all([
    supabase.rpc("get_gatekeeper_scan_stats",{p_event_id:assignedEvent.event_id}),
    supabase.rpc("get_gatekeeper_manual_history",{p_event_id:assignedEvent.event_id})
   ]);
   if(!alive)return;
   if(stats)setGatekeeperCounts({accepted:Number(stats.accepted||0),used:Number(stats.used||0),forged:Number(stats.forged||0)});
   if(!error&&Array.isArray(history))setGatekeeperManualHistory(history);
  };
  void refreshGatekeeperData();
  const channel=supabase.channel("gatekeeper-live-"+assignedEvent.event_id)
   .on("postgres_changes",{event:"*",schema:"public",table:"gatekeeper_scan_logs",filter:"event_id=eq."+assignedEvent.event_id},()=>{void refreshGatekeeperData();})
   .subscribe();
  return()=>{alive=false;void supabase.removeChannel(channel);};
 },[isGatekeeperPage,authUser,assignedEvent?.event_id,userRole]);
 useEffect(()=>{
  const update=()=>setGatekeeperOnline(typeof navigator!=="undefined"?navigator.onLine:true);
  update();window.addEventListener("online",update);window.addEventListener("offline",update);
  return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update);};
 },[]);
 useEffect(()=>{
  if(!scannerOpen||activeWorkspace!=="gatekeeper")return;
  let stopped=false;
  let scannerControls:{stop:()=>void}|undefined;
  const start=async()=>{
   const video=videoRef.current;
   if(!video)return;
   try{
    const reader=new BrowserQRCodeReader(undefined,{delayBetweenScanAttempts:120,delayBetweenScanSuccess:500});
    scannerControls=await reader.decodeFromConstraints(
     {audio:false,video:{facingMode:{ideal:"environment"}}},
     video,
     (result,_error,controls)=>{
      if(stopped||!result)return;
      const value=result.getText().trim();
      if(!/^[A-Za-z0-9]{10}$/.test(value)){
       setGatekeeperResult({ok:false,status:"error",message:"الرمز مقروء، لكن محتواه لا يطابق كود تذكرة حاضر المكوّن من 10 خانات."});
       return;
      }
      stopped=true;
      controls.stop();
      setGatekeeperCode(value.toUpperCase());
      setScannerOpen(false);
      setGatekeeperResult(null);
      void runGatekeeperAction(true,value);
     }
    );
   }catch(error){
    if(stopped)return;
    const message=error instanceof Error?error.message:"";
    setGatekeeperResult({ok:false,status:"error",message:message.toLowerCase().includes("permission")||message.toLowerCase().includes("denied")?"إذن الكاميرا مرفوض. اسمح للمتصفح باستخدام الكاميرا ثم أعد المحاولة.":"تعذر تشغيل قارئ QR أو الكاميرا. تأكد من إذن الكاميرا واتصال HTTPS، أو أدخل كود التذكرة يدوياً."});
   }
  };
  void start();
  return()=>{
   stopped=true;
   scannerControls?.stop();
  };
 },[scannerOpen,activeWorkspace]);
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
 const resetBooking=()=>{setSelectedEvent(null);setSelectedTier(0);setTierChosen(false);setShowPayment(false);setTicketCount(1);setPaymentMethod("");setReceipt(null);setBookingDone(false);setBookingId(null);setBookingNumber("");setBookingError("");setBookingSubmitting(false);};
 const go=(tab:Tab)=>{
  resetBooking();setActiveTab(tab);
  const url=new URL(window.location.href);
  if(tab==="home")url.searchParams.delete("tab");else url.searchParams.set("tab",tab);
  url.searchParams.delete("workspace");setIsGatekeeperPage(false);setActiveWorkspace(null);
  window.history.replaceState({}, "", url.pathname+url.search+url.hash);
  window.scrollTo({top:0,behavior:"smooth"});
 }; const downloadTicket=async(ticket:any)=>{try{const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext("2d");if(!ctx)return;await document.fonts.ready;ctx.fillStyle="#f7f1fb";ctx.fillRect(0,0,1080,1350);ctx.fillStyle="#fff";ctx.fillRect(48,48,984,1254);ctx.strokeStyle="#e7d9f1";ctx.lineWidth=3;ctx.strokeRect(48,48,984,1254);ctx.direction="rtl";ctx.textAlign="right";const right=950;ctx.fillStyle="#5b2e82";ctx.font="bold 48px Alexandria,Arial";ctx.fillText("حاضر  HADDIR",right,135);ctx.fillStyle="#8b7897";ctx.font="26px Alexandria,Arial";ctx.fillText("تذكرة دخول إلكترونية",right,190);ctx.strokeStyle="#dfd1e9";ctx.setLineDash([10,9]);ctx.beginPath();ctx.moveTo(100,230);ctx.lineTo(980,230);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="#8b7897";ctx.font="26px Alexandria,Arial";ctx.fillText("الفعالية",right,300);ctx.fillStyle="#30213b";ctx.font="bold 44px Alexandria,Arial";const eventTitle=String(ticket.events?.title||"فعالية");ctx.fillText(eventTitle.length>32?eventTitle.slice(0,32)+"…":eventTitle,right,365);ctx.fillStyle="#8b7897";ctx.font="24px Alexandria,Arial";ctx.fillText("نوع التذكرة",right,455);ctx.fillText("رقم الحجز",520,455);ctx.fillStyle="#3d3047";ctx.font="bold 27px Alexandria,Arial";ctx.fillText(String(ticket.ticket_types?.name||"تذكرة"),right,500);ctx.fillText(String(ticket.bookings?.booking_number||"—"),520,500);ctx.fillStyle="#8b7897";ctx.font="24px Alexandria,Arial";ctx.fillText("الموقع",right,575);ctx.fillText("التاريخ",520,575);ctx.fillStyle="#3d3047";ctx.font="bold 25px Alexandria,Arial";ctx.fillText(String(ticket.events?.venue||"—"),right,620);ctx.fillText(ticket.events?.starts_at?formatEventDate(ticket.events.starts_at):"—",520,620);ctx.strokeStyle="#e5d9ed";ctx.setLineDash([10,9]);ctx.beginPath();ctx.moveTo(100,675);ctx.lineTo(980,675);ctx.stroke();ctx.setLineDash([]);const qr=document.querySelector('[data-ticket-id="'+String(ticket.id)+'"] .haddir-ticket-qr svg');if(!qr)throw new Error("QR unavailable");const svg=new XMLSerializer().serializeToString(qr);const img=new Image();const loaded=new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error("QR image failed"));});img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);await loaded;ctx.drawImage(img,330,700,420,420);ctx.fillStyle="#8e8297";ctx.font="23px Alexandria,Arial";ctx.textAlign="center";ctx.fillText("امسح الرمز للتحقق من التذكرة",540,1045);ctx.fillStyle="#5c2e82";ctx.font="bold 48px Arial";ctx.fillText(String(ticket.ticket_code||""),540,1120);ctx.fillStyle="#f6f0fa";ctx.fillRect(48,1190,984,112);ctx.fillStyle="#76558d";ctx.font="bold 23px Alexandria,Arial";ctx.fillText("احتفظ بالتذكرة وأبرزها عند الدخول",540,1255);const link=document.createElement("a");link.download="haddir-ticket-"+String(ticket.ticket_code||ticket.id)+".png";link.href=canvas.toDataURL("image/png");link.click();}catch(error){console.error("Ticket image export failed",error);alert("تعذر حفظ التذكرة كصورة. حاول مرة أخرى.");}};
 const openEvent=(id:string)=>{resetBooking();window.history.pushState({...window.history.state,haddirPage:"event-detail"},"",window.location.href);setSelectedEvent(id);window.scrollTo({top:0,behavior:"smooth"});};
 const openPayment=async()=>{if(!tierChosen)return;if(!authUser){setAuthMessage("سجّل الدخول أولاً عشان نكمل حجزك. الفعاليات متاحة للتصفح بدون حساب.");setSelectedEvent(null);setShowPayment(false);setActiveTab("profile");window.scrollTo({top:0,behavior:"smooth"});return;}setAuthMessage("");const supabase=getSupabaseBrowserClient();if(supabase&&selected){const {data,error}=await supabase.from("event_payment_accounts").select("id,account_name,account_number,beneficiary").eq("event_id",selected.id).eq("is_active",true).order("sort_order");if(error){setBookingError("تعذر تحميل حسابات الدفع لهذه الفعالية: "+error.message);return;}const accounts=(data||[]) as EventPaymentAccount[];setEventPaymentAccounts(accounts);setPaymentMethod(accounts[0]?.id||"");}window.history.pushState({...window.history.state,haddirPage:"event-payment"},"",window.location.href);setShowPayment(true);window.scrollTo({top:0,behavior:"smooth"});};
 const backToDetails=()=>{if((window.history.state as {haddirPage?:string}|null)?.haddirPage==="event-payment"){window.history.back();return;}setShowPayment(false);window.scrollTo({top:0,behavior:"smooth"});};
 const submitBooking=async(e:any)=>{
  e.preventDefault();
  if(!receipt){setBookingError("ارفع صورة إيصال التحويل أولاً.");return;}
  if(!authUser||!selected||!selected.tiers[selectedTier]){setBookingError("انتهت جلسة الحجز. سجّل الدخول وحاول مرة أخرى.");return;}
  if(!eventPaymentAccounts.some(a=>a.id===paymentMethod)){setBookingError("اختر حساب دفع متاح لهذه الفعالية.");return;}
  if(!["image/jpeg","image/png","image/webp"].includes(receipt.type)){setBookingError("الصيغ المدعومة: JPG أو PNG أو WebP.");return;}
  if(receipt.size>5*1024*1024){setBookingError("حجم الإيصال يجب ألا يتجاوز 5 ميجابايت.");return;}
  const supabase=getSupabaseBrowserClient();
  if(!supabase){setBookingError("تعذر الاتصال بقاعدة البيانات حالياً.");return;}
  setBookingSubmitting(true);setBookingError("");
  let activeBookingId=bookingId;
  if(!activeBookingId){
   const {data,error}=await supabase.rpc("create_booking",{p_event_id:selected.id,p_ticket_type_id:selected.tiers[selectedTier].id,p_quantity:ticketCount});
   if(error){setBookingSubmitting(false);setBookingError(error.message||"ما قدرنا ننشئ الحجز.");return;}
   const created=Array.isArray(data)?data[0]:data;
   if(!created?.booking_id){setBookingSubmitting(false);setBookingError("لم نستلم تأكيد إنشاء الحجز.");return;}
   activeBookingId=created.booking_id;setBookingId(activeBookingId);setBookingNumber(created.booking_number||"");
  }
  const ext=receipt.type==="image/png"?"png":receipt.type==="image/webp"?"webp":"jpg";
  const receiptPath=authUser.id+"/"+activeBookingId+"/"+crypto.randomUUID()+"."+ext;
  const {error:uploadError}=await supabase.storage.from("payment-receipts").upload(receiptPath,receipt,{contentType:receipt.type,upsert:false,cacheControl:"3600"});
  if(uploadError){setBookingSubmitting(false);setBookingError("تم حفظ الحجز لكن تعذر رفع الإيصال: "+uploadError.message+". يمكنك المحاولة مرة أخرى.");return;}
  const {data:submissionId,error:submitError}=await supabase.rpc("submit_payment",{p_booking_id:activeBookingId,p_payment_method_id:paymentMethod,p_receipt_path:receiptPath,p_transfer_reference:null});
  if(submitError||!submissionId){
   await supabase.storage.from("payment-receipts").remove([receiptPath]);
   setBookingSubmitting(false);setBookingError(submitError?.message||"تعذر إرسال إثبات الدفع للمراجعة. حاول مرة أخرى.");return;
  }
  setBookingSubmitting(false);setBookingDone(true);setActiveTab("notifications");
 };
 return <main dir="rtl" lang="ar" className={"app-shell"+(darkMode?" theme-dark":"")}>
 <>
 {!selected&&(isGatekeeperPage?<header className="screen-topbar gatekeeper-page-topbar"><button type="button" className="btn btn-outline" onClick={()=>{setIsGatekeeperPage(false);setActiveWorkspace(null);const url=new URL(window.location.href);url.searchParams.delete("workspace");window.location.assign(url.pathname+url.search+url.hash);}}>العودة للملف الشخصي</button><strong>مسح التذاكر</strong><span className="screen-icon"><ScanLine/></span></header>:activeTab==="home"?<header className="topbar"><div className="container header-inner"><button className="brand brand-button" onClick={()=>go("home")}><span className="brand-mark">ح</span> حاضر</button><div className="desktop-greeting">من السودان، لكل لحظة تستاهل الحضور.</div><button className="header-icon theme-toggle" type="button" aria-label={darkMode?"تفعيل الوضع النهاري":"تفعيل الوضع الليلي"} aria-pressed={darkMode} onClick={()=>setDarkMode(v=>!v)}>{darkMode?<span>☀</span>:<span>☾</span>}</button></div></header>:<header className="screen-topbar"><span className="screen-topbar-spacer" aria-hidden="true"/><strong>{({tickets:"تذاكري",notifications:"الإشعارات",profile:"الملف الشخصي"} as Record<string,string>)[activeTab]}</strong><span className="screen-icon">{activeTab==="tickets"?<Ticket/>:activeTab==="notifications"?<Bell/>:<UserRound/>}</span></header>)}
 <div className="app-content">
 {!isGatekeeperPage&&activeTab==="home"&&<>
 {showWelcome&&<div className="welcome-motion" role="status"><span className="welcome-spark"><Sparkles size={19}/></span><div><strong>أهلاً بيك في حاضر</strong><p>لحظاتك الحلوة بتبدأ من هنا</p></div><span className="welcome-orbit">✦</span></div>}
 <section className="home-discovery redesigned-home" id="events"><div className="container">
  {eventsLoading?<div className="empty-state"><strong>جاري تحميل الفعاليات...</strong></div>:eventsError?<div className="empty-state" role="alert"><strong>ما قدرنا نحمّل الفعاليات</strong><p>{eventsError}</p><button className="btn btn-outline" onClick={()=>window.location.reload()}>إعادة المحاولة</button></div>:<>
   <section className="trending-section">
    <div className="redesign-section-head"><div className="redesign-title"><h2>رائج الآن</h2><span className="trending-dot" aria-hidden="true"/></div></div>
    {events.some(e=>e.isTrending)?<div className="trending-carousel hide-scrollbar" dir="ltr"><div className="trending-track"><div className="trending-group">{trendingEvents.map(e=><article className="trending-card snap-item" key={e.id} role="button" tabIndex={0} aria-label={"عرض تفاصيل "+e.title} onClick={()=>openEvent(e.id)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openEvent(e.id);}}}><div className={"trending-card-media "+e.cover}>{e.coverImageUrl?<img src={e.coverImageUrl} alt={e.title} loading="lazy"/>:<span className="trending-placeholder">✦</span>}<div className="trending-overlay"/><span className="trending-category">{e.category}</span><span className="trending-price">{e.price}</span><div className="trending-card-copy"><h3>{e.title}</h3><div><CalendarDays size={14}/><span>{e.date} · {e.time}</span></div><div><MapPin size={14}/><span>{e.venue||e.place}</span></div></div></div></article>)}</div><div className="trending-group" aria-hidden="true" inert>{trendingEvents.map(e=><article className="trending-card snap-item" key={e.id+"-loop"} tabIndex={-1}><div className={"trending-card-media "+e.cover}>{e.coverImageUrl?<img src={e.coverImageUrl} alt="" loading="lazy"/>:<span className="trending-placeholder">✦</span>}<div className="trending-overlay"/><span className="trending-category">{e.category}</span><span className="trending-price">{e.price}</span><div className="trending-card-copy"><h3>{e.title}</h3><div><CalendarDays size={14}/><span>{e.date} · {e.time}</span></div><div><MapPin size={14}/><span>{e.venue||e.place}</span></div></div></div></article>)}</div></div></div>:<div className="empty-state">ما في فعاليات رائجة حالياً.</div>}
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
  {isGatekeeperPage&&<section className="screen container gatekeeper-page-screen" aria-label="واجهة البواب">
  {(userRole==="gatekeeper"||userRole==="organizer")?<div className="gatekeeper-workspace">
   <div className="gatekeeper-workspace-head"><div><small>مساحة البواب</small><h2>فحص تذاكر الدخول</h2><p>{assignedEvent?.events?.title||"لم يتم ربط فعالية بحسابك"}</p></div><div className="gatekeeper-head-actions"><span className={"gatekeeper-network "+(gatekeeperOnline?"online":"offline")}><i/>{gatekeeperOnline?"متصل بالشبكة":"غير متصل"}</span><button type="button" className="btn btn-outline" onClick={()=>{const url=new URL(window.location.href);url.searchParams.delete("workspace");url.searchParams.set("tab","profile");window.location.assign(url.pathname+url.search+url.hash);}}>إغلاق</button></div></div>
   <div className="gatekeeper-counter-grid"><article className="accepted"><small>مقبولة</small><strong>{gatekeeperCounts.accepted}</strong></article><article className="used"><small>مستخدمة</small><strong>{gatekeeperCounts.used}</strong></article><article className="forged"><small>مزوّرة</small><strong>{gatekeeperCounts.forged}</strong></article></div>
   {assignedEvent?.events&&<div className="gatekeeper-assigned-event"><small>الفعالية المصرح لك بها</small><strong>{assignedEvent.events.title}</strong><span>{assignedEvent.events.venue||assignedEvent.events.city||"الموقع غير محدد"} · {assignedEvent.events.starts_at?formatEventDate(assignedEvent.events.starts_at):"موعد غير محدد"}</span></div>}
   {!assignedEvent&&<p className="gatekeeper-inline-error">حسابك غير مربوط بفعالية حالياً. راجع إدارة حاضر لتعيين الفعالية.</p>}
    <div className="gatekeeper-actions"><button type="button" className="btn btn-primary" disabled={!assignedEvent||gatekeeperLoading||!gatekeeperOnline} onClick={()=>{setGatekeeperResult(null);setManualEntryOpen(false);setScannerOpen(v=>!v);}}><ScanLine size={18}/>{scannerOpen?"إغلاق الكاميرا":"مسح بالكاميرا"}</button><button type="button" className="btn btn-outline" disabled={!assignedEvent||gatekeeperLoading} onClick={()=>{setScannerOpen(false);setGatekeeperResult(null);setManualEntryOpen(true);}}><ClipboardList size={18}/>إدخال يدوي</button></div>
   {scannerOpen&&<div className="gatekeeper-camera"><video ref={videoRef} autoPlay playsInline muted/><p>وجّه الكاميرا نحو رمز QR. إذا لم تعمل الكاميرا، أدخل الكود يدوياً.</p></div>}
   {manualEntryOpen&&<form className="gatekeeper-manual-form" onSubmit={e=>{e.preventDefault();setScannerOpen(false);setManualEntryOpen(false);void runGatekeeperAction(true,gatekeeperCode,"manual");}}><label className="gatekeeper-input" htmlFor="gatekeeper-manual-code">كود التذكرة — 10 أرقام فقط</label><div><input id="gatekeeper-manual-code" type="text" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} minLength={10} value={gatekeeperCode} onChange={e=>setGatekeeperCode(e.target.value.replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[^0-9]/g,"").slice(0,10))} placeholder="0000000000" dir="ltr" autoComplete="off" aria-describedby="gatekeeper-manual-hint"/><button type="submit" className="btn btn-outline" disabled={!assignedEvent||gatekeeperLoading||!/^[0-9]{10}$/.test(gatekeeperCode)}>{gatekeeperLoading?"جاري الفحص...":"تحقق ودخول"}</button></div><small id="gatekeeper-manual-hint">أدخل عشرة أرقام متتالية دون حروف أو رموز.</small></form>}
   {gatekeeperResult&&<div className={"gatekeeper-result "+(gatekeeperResult.status==="checked_in"?"valid":gatekeeperResult.status==="used"?"used":gatekeeperResult.status==="not_found"?"invalid":"error")}><strong>{gatekeeperResult.status==="checked_in"?"مقبولة — تم تسجيل استخدامها بنجاح":gatekeeperResult.status==="used"?"مستخدمة — تم استخدام هذه التذكرة من قبل":gatekeeperResult.status==="not_found"?"مزوّرة — هذا الكود غير صادر من نظام حاضر":gatekeeperResult.message}</strong>{gatekeeperResult.ticket_code&&<div className="gatekeeper-result-details"><span>اسم المشتري: {gatekeeperResult.buyer_name||gatekeeperResult.attendee_name||"—"}</span><span>الفعالية: {gatekeeperResult.event_title||"—"}</span><span>فئة التذكرة: {gatekeeperResult.ticket_type||"—"}</span>{gatekeeperResult.attendee_count!=null&&<span>عدد الأفراد في الحجز: {gatekeeperResult.attendee_count}</span>}<span>الكود: {gatekeeperResult.ticket_code}</span></div>}{gatekeeperResult.status==="checked_in"&&<p>تم تحديث حالة التذكرة في النظام إلى «مستخدمة»، ولن تُقبل مرة أخرى.</p>}</div>}
   <section className="gatekeeper-manual-history" aria-label="سجل الإدخال اليدوي"><div className="gatekeeper-manual-history-head"><strong>سجل الإدخال اليدوي</strong><span>{gatekeeperManualHistory.length} عملية</span></div>{gatekeeperHistoryLoading?<p className="gatekeeper-history-empty">جاري تحميل السجل...</p>:gatekeeperManualHistory.length===0?<p className="gatekeeper-history-empty">ما في عمليات إدخال يدوي مسجلة حتى الآن.</p>:<div className="gatekeeper-history-list">{gatekeeperManualHistory.map((item:any)=><article className="gatekeeper-history-item" key={item.id}><div className="gatekeeper-history-code" dir="ltr">{item.ticket_code||"—"}</div><div className="gatekeeper-history-meta"><strong className={item.outcome==="accepted"?"accepted":item.outcome==="used"?"used":item.outcome==="forged"?"forged":"invalid"}>{item.outcome==="accepted"?"مقبولة — تم الدخول":item.outcome==="used"?"مستخدمة مسبقاً":item.outcome==="forged"?"كود غير صحيح":"تذكرة غير صالحة"}</strong><small>{item.scanned_at?new Date(item.scanned_at).toLocaleString("ar-SD"):"—"}</small></div></article>)}</div>}</section>
  </div>:<div className="empty-state" role="alert"><strong>ما عندك صلاحية لواجهة البواب</strong><p>الواجهة دي مخصصة لحسابات البواب والمنظم المعتمدة فقط.</p><button className="btn btn-outline" type="button" onClick={()=>window.location.assign("/?tab=profile")}>العودة للملف الشخصي</button></div>}
 </section>}
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
     {ticketTypesError?<div className="empty-state" role="alert"><strong>تعذر تحميل فئات التذاكر</strong><p>{ticketTypesError}</p><button className="btn btn-outline" onClick={()=>window.location.reload()}>إعادة المحاولة</button></div>:(selected.tiers||[]).length?<div className="tier-list">{selected.tiers.map((tier,index)=><button type="button" key={tier.name} className={"tier-card "+(selectedTier===index&&tierChosen?"tier-selected":"")} aria-pressed={selectedTier===index&&tierChosen} disabled={!tier.availableNow||tier.available<=0} onClick={()=>{setSelectedTier(index);setTierChosen(true);setTicketCount(1);}}><span className="tier-radio">{selectedTier===index&&tierChosen?<CheckCircle2 size={17}/>:null}</span><span className="tier-copy"><strong className="tier-name">{tier.name}</strong>{tier.description&&<small>{tier.description}</small>}</span><strong className="tier-price">{tier.price}</strong><small className="tier-availability">{tier.availableNow?`متبقي ${tier.available} تذكرة`:tier.available<=0?"نفدت التذاكر":"البيع غير متاح حالياً"}</small></button>)}</div>:<div className="empty-state">لم تُضف فئات تذاكر لهذه الفعالية بعد.</div>}
    </section>
    {tierChosen&&<section className="detail-quantity quantity-reveal"><div className="quantity-heading"><h3>عدد التذاكر</h3><span>المتاح: {Math.min(5,selected.tiers[selectedTier].available)} تذاكر</span></div><div className="quantity-control"><button type="button" aria-label="تقليل عدد التذاكر" disabled={ticketCount<=1} onClick={()=>setTicketCount(n=>Math.max(1,n-1))}>−</button><strong>{ticketCount}</strong><button type="button" aria-label="زيادة عدد التذاكر" disabled={ticketCount>=Math.min(5,selected.tiers[selectedTier].available)} onClick={()=>setTicketCount(n=>Math.min(5,n+1))}>+</button></div></section>}
    {tierChosen&&<div className="detail-booking-dock actionable-footer"><div className="detail-dock-summary"><small>المبلغ الإجمالي <span className="ticket-count-badge">{ticketCount} تذاكر</span></small><strong>{selected.tiers[selectedTier].price==="مجاناً"?"مجاناً":formatMoney(selected.tiers[selectedTier].priceValue*ticketCount,selected.tiers[selectedTier].currency)}</strong><span>{selected.tiers[selectedTier].name}</span></div><button className="btn btn-primary pay-button" disabled={!selected.tiers[selectedTier]?.availableNow||selected.tiers[selectedTier]?.available<ticketCount||["تم البيع بالكامل","انتهت","غير متاح","البيع غير متاح حالياً"].includes(selected.status)} onClick={openPayment}>ادفع الآن <ArrowLeft size={18}/></button></div>}
   </div>
  </div>
 </div>:<div className="detail-sheet event-detail-layout payment-sheet"><button className="detail-back checkout-back" onClick={backToDetails}><ArrowLeft size={18}/> العودة للتفاصيل</button><div className="payment-screen"><div className="booking-steps" aria-label="خطوات الحجز"><span className="step-done">١. اختيار الفئة</span><span className="step-done">٢. مراجعة الحجز</span><span className="step-current">٣. الدفع</span></div>{!bookingDone?<form className="checkout-form" onSubmit={submitBooking}><div className="payment-icon"><CreditCard size={28}/></div><span className="section-kicker">الخطوة الثالثة من الحجز</span><h1>إتمام الحجز</h1><p>راجع تفاصيل حجزك وأكمل بيانات الدفع.</p><div className="checkout-event"><span className={"checkout-thumb event-cover "+selected.cover}>{selected.coverImageUrl&&<img className="event-cover-image" src={selected.coverImageUrl} alt=""/>}{!selected.coverImageUrl&&<span className="cover-symbol">✦</span>}</span><div><strong>{selected.title}</strong><small>{selected.tiers[selectedTier].name}</small></div></div><div className="checkout-total"><span>الإجمالي</span><strong>{selected.tiers[selectedTier].price==="مجاناً"?"مجاناً":formatMoney(selected.tiers[selectedTier].priceValue*ticketCount,selected.tiers[selectedTier].currency)}</strong></div><section className="checkout-section"><h2>طريقة الدفع</h2><label className="checkout-label"><span>اختر حساب التحويل</span><select required value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} disabled={eventPaymentAccounts.length===0}>{eventPaymentAccounts.map(account=><option key={account.id} value={account.id}>{account.account_name}</option>)}</select></label><div className="account-details"><div><small>رقم الحساب</small><strong dir="ltr">{eventPaymentAccounts.find(a=>a.id===paymentMethod)?.account_number||"—"}</strong></div><div><small>اسم المستفيد</small><strong>{eventPaymentAccounts.find(a=>a.id===paymentMethod)?.beneficiary||"—"}</strong></div></div><p className="account-note">"حوّل المبلغ الموضح أعلاه إلى حساب الفعالية المحدد، ثم ارفع صورة الإيصال لإرسال طلبك للمراجعة."</p>{!eventPaymentAccounts.length&&<p className="checkout-footnote" role="alert">لم تُضف حسابات دفع لهذه الفعالية بعد. يرجى التواصل مع منظم الفعالية.</p>}</section><section className="checkout-section"><h2>إيصال التحويل</h2><label className="receipt-upload"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setReceipt(e.target.files?.[0]||null)}/><span className="upload-symbol"><CreditCard size={20}/></span><strong>{receipt?receipt.name:"ارفع صورة إيصال التحويل"}</strong><small>JPG أو PNG أو WebP · بحد أقصى 5 ميجابايت</small><span className="upload-action">{receipt?"تغيير الصورة":"اختيار صورة"}</span></label></section>{receipt&&<button className="btn btn-primary pay-button" type="submit" disabled={bookingSubmitting||eventPaymentAccounts.length===0}>{bookingSubmitting?"جاري رفع الإيصال وإرسال الطلب...":"إرسال طلب الدفع للمراجعة"} <ArrowLeft size={17}/></button>}{bookingError&&<p className="checkout-footnote" role="alert">{bookingError}</p>}<p className="checkout-footnote">سيتم مراجعة الإيصال وتحديث حالة طلبك عبر الإشعارات. لا يتم إصدار التذكرة إلا بعد اعتماد الدفع.</p></form>:<div className="booking-success"><span className="success-mark"><CheckCircle2 size={34}/></span><span className="section-kicker">تم بنجاح</span><h1>استلمنا طلب حجزك!</h1><p>تم استلام إثبات الدفع للحجز <strong>{bookingNumber}</strong> لفعالية <strong>{selected.title}</strong>، وأُرسل الآن لفريق حاضر للمراجعة. ستصدر التذكرة ورمز QR بعد اعتماد الدفع.</p><div className="success-summary"><span>عدد التذاكر</span><strong>{ticketCount}</strong><span>الإجمالي</span><strong>{selected.tiers[selectedTier].price==="مجاناً"?"مجاناً":formatMoney(selected.tiers[selectedTier].priceValue*ticketCount)}</strong></div><button className="btn btn-primary pay-button" onClick={()=>{resetBooking();setActiveTab("notifications");}}>مراجعة الإشعارات <Bell size={17}/></button></div>}</div></div>}
 </section>}
 {!isGatekeeperPage&&!selected&&<nav className="bottom-nav" aria-label="التنقل الرئيسي"><button className={activeTab==="home"?"selected":""} onClick={()=>go("home")}><House size={21}/><span>الرئيسية</span></button><button className={activeTab==="tickets"?"selected":""} onClick={()=>go("tickets")}><Ticket size={21}/><span>تذاكري</span></button><button className={activeTab==="notifications"?"selected":""} onClick={()=>go("notifications")}><Bell size={21}/><span>الإشعارات</span></button><button className={activeTab==="profile"?"selected":""} onClick={()=>go("profile")}><UserRound size={21}/><span>حسابي</span></button></nav>}
 </>
 
 </main>;
}