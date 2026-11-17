"use client";
import {useCallback,useEffect,useState} from "react";
import {BellRing,BellOff,LoaderCircle} from "lucide-react";
import {getSupabaseBrowserClient} from "../../../lib/supabase/browser";

const VAPID_PUBLIC_KEY="BPfWEKhFdIhfUyMd4e6KYa68jkwKkuKRrXruLMkwCPx-izQCx8uyzISAUDGJ5XG8nhLQPmb3JSUaZ_KYbphQVIU";

function decodeKey(value:string):Uint8Array{
 const pad="=".repeat((4-value.length%4)%4);
 const raw=atob((value+pad).replace(/-/g,"+").replace(/_/g,"/"));
 return Uint8Array.from(raw,c=>c.charCodeAt(0));
}

export function PushNotificationSettings({userId}:{userId:string|null}){
 const [supported,setSupported]=useState(true);
 const [enabled,setEnabled]=useState(false);
 const [checking,setChecking]=useState(true);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");

 // Restore the real browser subscription whenever the page opens or returns to foreground.
 // Re-sync it with Supabase so a valid device subscription is never mistaken for an off state.
 const refreshStatus=useCallback(async()=>{
  if(!userId){setEnabled(false);setChecking(false);return;}
  setChecking(true);
  try{
   const ok="serviceWorker"in navigator&&"PushManager"in window&&"Notification"in window;
   setSupported(ok);
   if(!ok){setEnabled(false);return;}
   if(Notification.permission!=="granted"){setEnabled(false);return;}
   const reg=await navigator.serviceWorker.ready;
   const sub=await reg.pushManager.getSubscription();
   if(!sub){setEnabled(false);return;}
   const db=getSupabaseBrowserClient();
   if(!db){setEnabled(true);setMessage("الاشتراك موجود على الجهاز، لكن تعذرت مزامنته مع حاضر حالياً.");return;}
   const {error}=await db.rpc("sync_haddir_push_subscription",{
    p_endpoint:sub.endpoint,
    p_subscription:sub.toJSON(),
    p_device_label:navigator.userAgent.slice(0,160)
   });
   setEnabled(true);
   setMessage(error?"الإشعارات مفعّلة على الجهاز، لكن تعذرت مزامنة الاشتراك مع الخادم.":"");
  }catch(error){
   console.error("Push status restore failed",error);
   setMessage("تعذر التحقق من حالة الإشعارات حالياً. أعد فتح الصفحة بعد لحظات.");
  }finally{setChecking(false);}
 },[userId]);

 useEffect(()=>{
  let alive=true;
  const run=async()=>{if(alive)await refreshStatus();};
  void run();
  const onVisible=()=>{if(document.visibilityState==="visible")void run();};
  window.addEventListener("pageshow",onVisible);
  window.addEventListener("focus",onVisible);
  document.addEventListener("visibilitychange",onVisible);
  return()=>{
   alive=false;
   window.removeEventListener("pageshow",onVisible);
   window.removeEventListener("focus",onVisible);
   document.removeEventListener("visibilitychange",onVisible);
  };
 },[refreshStatus]);

 const enable=useCallback(async()=>{
  if(!userId||busy)return;
  setBusy(true);setMessage("");
  try{
   if(!("serviceWorker"in navigator)||!("PushManager"in window)||!("Notification"in window)){
    setSupported(false);return;
   }
   const ios=/iPad|iPhone|iPod/.test(navigator.userAgent);
   const standalone=matchMedia("(display-mode: standalone)").matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
   if(ios&&!standalone){setMessage("في الآيفون، أضف حاضر إلى الشاشة الرئيسية أولاً، ثم افتحه منها وفعّل الإشعارات.");return;}
   const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
   if(permission!=="granted"){
    setMessage(permission==="denied"?"الإشعارات محظورة من إعدادات المتصفح. غيّر الإذن من إعدادات الموقع.":"لم يتم السماح بالإشعارات.");
    return;
   }
   const reg=await navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"});
   await navigator.serviceWorker.ready;
   let sub=await reg.pushManager.getSubscription();
   if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(VAPID_PUBLIC_KEY) as BufferSource});
   const db=getSupabaseBrowserClient();
   if(!db)throw new Error("تعذر الاتصال بحاضر حالياً.");
   const {error}=await db.rpc("sync_haddir_push_subscription",{
    p_endpoint:sub.endpoint,
    p_subscription:sub.toJSON(),
    p_device_label:navigator.userAgent.slice(0,160)
   });
   if(error)throw error;
   setEnabled(true);setMessage("تم تفعيل الإشعارات الخارجية على هذا الجهاز.");
  }catch(error){
   console.error("Push subscription failed",error);
   setMessage(error instanceof Error?error.message:"تعذر تفعيل الإشعارات. حاول مرة أخرى.");
  }finally{setBusy(false);}
 },[userId,busy]);

 const disable=useCallback(async()=>{
  if(!userId||busy)return;
  setBusy(true);setMessage("");
  try{
   const reg=await navigator.serviceWorker.ready;
   const sub=await reg.pushManager.getSubscription();
   if(sub){
    const db=getSupabaseBrowserClient();
    if(!db)throw new Error("تعذر الاتصال بحاضر حالياً.");
    const {error}=await db.from("push_subscriptions").delete().eq("user_id",userId).eq("endpoint",sub.endpoint);
    if(error)throw error;
    await sub.unsubscribe();
   }
   setEnabled(false);setMessage("تم إيقاف الإشعارات الخارجية على هذا الجهاز.");
  }catch(error){
   console.error("Push unsubscribe failed",error);
   setMessage(error instanceof Error?error.message:"تعذر إيقاف الإشعارات حالياً.");
  }finally{setBusy(false);}
 },[userId,busy]);

 const isBusy=busy||checking;
 return <section className="profile-push-setting" aria-label="الإشعارات الخارجية" style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",margin:"14px 0 0",padding:"14px 15px",borderRadius:16,border:"1px solid var(--border,rgba(91,46,255,.2))",background:"var(--surface,#fff)",color:"var(--fg,#1A1533)"}}>
  <span aria-hidden="true" style={{width:42,height:42,flex:"0 0 42px",display:"grid",placeItems:"center",borderRadius:13,background:"rgba(91,46,255,.12)",color:"#5B2EFF"}}>{enabled?<BellRing size={21}/>:<BellOff size={21}/>}</span>
  <div style={{flex:"1 1 160px",minWidth:0}}>
   <strong style={{display:"block",fontSize:13}}>الإشعارات الخارجية</strong>
   <span style={{display:"block",marginTop:4,fontSize:11,lineHeight:1.7,opacity:.72}}>تصلك تحديثات حجوزاتك حتى لو حاضر مقفول.</span>
   {message&&<span role="status" aria-live="polite" style={{display:"block",marginTop:6,fontSize:11,lineHeight:1.7}}>{message}</span>}
  </div>
  {!supported?<span style={{fontSize:11,opacity:.7}}>غير مدعوم في هذا المتصفح</span>:<div style={{display:"flex",alignItems:"center",gap:9,flex:"0 0 auto"}}>
   <span aria-live="polite" style={{fontSize:11,fontWeight:800,whiteSpace:"nowrap"}}>{isBusy?<><LoaderCircle size={14} style={{display:"inline",verticalAlign:"middle",marginInlineEnd:5}}/>{checking?"جارٍ التحقق...":"جاري التنفيذ"}</>:enabled?"مفعّلة":"متوقفة"}</span>
   <button type="button" role="switch" aria-label="الإشعارات الخارجية" aria-checked={enabled} disabled={isBusy||!userId} onClick={()=>void(enabled?disable():enable())} style={{width:52,height:30,flex:"0 0 52px",display:"flex",alignItems:"center",justifyContent:enabled?"flex-start":"flex-end",padding:3,border:0,borderRadius:999,background:enabled?"#5B2EFF":"rgba(120,120,120,.3)",cursor:isBusy||!userId?"not-allowed":"pointer",opacity:(isBusy||!userId)?0.65:1,transition:"background .2s ease"}}>
    <span aria-hidden="true" style={{display:"block",width:24,height:24,borderRadius:"50%",background:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
   </button>
  </div>}
 </section>;
}
