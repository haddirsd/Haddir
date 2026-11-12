import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildPushPayload, type PushSubscription, type VapidKeys } from "npm:@block65/webcrypto-web-push@2.0.0";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const trusted=(value:string)=>{try{const u=new URL(value),h=u.hostname.toLowerCase();return u.protocol==="https:"&&(h==="fcm.googleapis.com"||h==="push.apple.com"||h.endsWith(".push.apple.com")||h.endsWith(".push.services.mozilla.com")||h.endsWith(".notify.windows.com")||h.endsWith(".push.samsung.com"));}catch{return false;}};
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return json({error:"Push service is not configured"},503);
 const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:cfg,error:cfgError}=await admin.rpc("get_haddir_push_config");
 if(cfgError||!cfg?.private_key||!cfg?.public_key||!cfg?.hook_secret)return json({error:"Push credentials are unavailable"},503);
 const supplied=req.headers.get("x-haddir-push-hook")||"";
 if(supplied.length!==cfg.hook_secret.length||supplied!==cfg.hook_secret)return json({error:"Unauthorized"},401);
 let body:{user_id?:string;notification_id?:string;title?:string;message?:string;type?:string;url?:string};
 try{body=await req.json();}catch{return json({error:"Invalid JSON"},400);}
 if(!body.user_id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.user_id)||!body.title||!body.message)return json({error:"Invalid notification payload"},400);
 const {data:rows,error}=await admin.from("push_subscriptions").select("id,endpoint,subscription").eq("user_id",body.user_id);
 if(error)return json({error:"Could not load subscriptions"},500);
 if(!rows?.length)return json({sent:0,expired:0,failed:0,status:"no_subscriptions"});
 const vapid:VapidKeys={subject:"https://haddir-ticket.vercel.app",publicKey:cfg.public_key,privateKey:cfg.private_key};
 const target=typeof body.url==="string"&&body.url.startsWith("/")&&!body.url.startsWith("//")?body.url:"/?tab=notifications";
 let sent=0,expired=0,failed=0;
 await Promise.all(rows.map(async row=>{
  if(!trusted(row.endpoint)){failed++;return;}
  try{
   const payload=await buildPushPayload({data:{title:body.title,body:body.message,url:target,tag:body.notification_id||body.type||"haddir-notification",icon:"/icons/icon-192-brand.svg",badge:"/icons/icon-192-brand.svg"},options:{ttl:3600,urgency:"high"}},row.subscription as PushSubscription,vapid);
   const response=await fetch(row.endpoint,payload);
   if(response.status===404||response.status===410){await admin.from("push_subscriptions").delete().eq("id",row.id);expired++;}
   else if(response.ok)sent++;else failed++;
  }catch{failed++;}
 }));
 return json({sent,expired,failed,status:"processed"});
});
