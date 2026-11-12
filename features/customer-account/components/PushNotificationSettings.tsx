"use client";
import {useCallback,useEffect,useState} from "react";
import {BellRing,BellOff,LoaderCircle} from "lucide-react";
import {getSupabaseBrowserClient} from "../../../lib/supabase";
const VAPID_PUBLIC_KEY="BPfWEKhFdIhfUyMd4e6KYa68jkwKkuKRrXruLMkwCPx-izQCx8uyzISAUDGJ5XG8nhLQPmb3JSUaZ_KYbphQVIU";
function decodeKey(value:string):Uint8Array{const pad="=".repeat((4-value.length%4)%4);const raw=atob((value+pad).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
export function PushNotificationSettings({userId}:{userId:string|null}){
 const [supported,setSupported]=useState(true),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{let alive=true;(async()=>{const ok="serviceWorker"in navigator&&"PushManager"in window&&"Notification"in window;setSupported(ok);if(!ok||!userId)return;try{const reg=await navigator.serviceWorker.getRegistration("/");const sub=await reg?.pushManager.getSubscription();if(!alive)return;if(!sub){setEnabled(false);return;}const db=getSupabaseBrowserClient();if(!db)return;const {data}=await db.from("push_subscriptions").select("id").eq("user_id",userId).eq("endpoint",sub.endpoint).maybeSingle();if(alive)setEnabled(!!data);}catch{if(alive)setEnabled(false);}})();return()=>{alive=false;};},[userId]);
 const enable=useCallback(async()=>{if(!userId||busy)return;setBusy(true);setMessage("");try{
  if(!("serviceWorker"in navigator)||!("PushManager"in window)||!("Notification"in window)){setSupported(false);return;}
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent),standalone=matchMedia("(display-mode: standalone)").matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
  if(ios&&!standalone){setMessage("في الآيفون، أضف حاضر إلى الشاشة الرئيسية أولاً، ثم افتحه منها وفعّل الإشعارات.");return;}
  const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
  if(permission!=="granted"){setMessage(permission==="denied"?"الإشعارات محظورة من إعدادات المتصفح. غيّر الإذن من إعدادات الموقع.":"لم يتم السماح بالإشعارات.");return;}
  const reg=await navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"});await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(VAPID_PUBLIC_KEY) as BufferSource});
  const db=getSupabaseBrowserClient();if(!db)throw new Error("تعذر الاتصال بحاضر حالياً.");
  const {error}=await db.from("push_subscriptions").upsert({user_id:userId,endpoint:sub.endpoint,subscription:sub.toJSON(),device_label:navigator.userAgent.slice(0,160),updated_at:new Date().toISOString()},{onConflict:"endpoint"});
  if(error)throw error;setEnabled(true);setMessage("تم تفعيل الإشعارات الخارجية على هذا الجهاز.");
 }catch(e){console.error("Push subscription failed",e);setMessage(e instanceof Error?e.message:"تعذر تفعيل الإشعارات. حاول مرة أخرى.");}finally{setBusy(false);}},[userId,busy]);
 const disable=useCallback(async()=>{if(!userId||busy)return;setBusy(true);setMessage("");try{const reg=await navigator.serviceWorker.getRegistration("/");const sub=await reg?.pushManager.getSubscription();const db=getSupabaseBrowserClient();if(sub&&db){const {error}=await db.from("push_subscriptions").delete().eq("user_id",userId).eq("endpoint",sub.endpoint);if(error)throw error;await sub.unsubscribe();}setEnabled(false);setMessage("تم إيقاف الإشعارات الخارجية على هذا الجهاز.");}catch(e){console.error("Push unsubscribe failed",e);setMessage(e instanceof Error?e.message:"تعذر إيقاف الإشعارات حالياً.");}finally{setBusy(false);}},[userId,busy]);
 return <section aria-label="الإشعارات الخارجية" style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",margin:"0 0 18px",padding:"14px 15px",borderRadius:16,border:"1px solid var(--border,rgba(91,46,255,.2))",background:"var(--surface,#fff)",color:"var(--fg,#1A1533)"}}>
  <span aria-hidden="true" style={{width:42,height:42,flex:"0 0 42px",display:"grid",placeItems:"center",borderRadius:13,background:"rgba(91,46,255,.12)",color:"#5B2EFF"}}>{enabled?<BellRing size={21}/>:<BellOff size={21}/>}</span>
  <div style={{flex:"1 1 160px",minWidth:0}}><strong style={{display:"block",fontSize:13}}>الإشعارات الخارجية</strong><span style={{display:"block",marginTop:4,fontSize:11,lineHeight:1.7,opacity:.72}}>تصلك تحديثات حجوزاتك حتى لو حاضر مقفول.</span>{message&&<span role="status" aria-live="polite" style={{display:"block",marginTop:6,fontSize:11,lineHeight:1.7}}>{message}</span>}</div>
  {!supported?<span style={{fontSize:11,opacity:.7}}>غير مدعوم في هذا المتصفح</span>:<button type="button" disabled={busy||!userId} onClick={()=>void(enabled?disable():enable())} style={{minHeight:40,border:0,borderRadius:11,padding:"0 14px",background:enabled?"rgba(91,46,255,.12)":"#5B2EFF",color:enabled?"var(--fg,#1A1533)":"#fff",font:"inherit",fontSize:11,fontWeight:800,cursor:busy?"wait":"pointer",opacity:busy?.65:1}}>{busy?<><LoaderCircle size={14} style={{display:"inline",verticalAlign:"middle",marginInlineEnd:5}}/> جاري التنفيذ</>:enabled?"إيقاف الإشعارات":"تفعيل الإشعارات"}</button>}
 </section>;
}
