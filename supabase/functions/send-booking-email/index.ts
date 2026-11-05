import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  const appBaseUrl = (Deno.env.get("APP_BASE_URL") || "https://haddir-haddir-ticket.vercel.app").replace(/\/$/, "");

  if (!supabaseUrl || !serviceKey) return json({ error: "Email worker is not configured" }, 503);
  if (!resendKey || !from) return json({ configured: false, status: "waiting_for_resend_setup" }, 503);

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Authentication required" }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Invalid session" }, 401);

  const { data: profile } = await admin.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
  if (!profile || !["owner", "admin", "supervisor"].includes(profile.role)) {
    return json({ error: "Not allowed" }, 403);
  }

  let body: { booking_id?: string; decision?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!body.booking_id || !["approve", "reject"].includes(body.decision || "")) {
    return json({ error: "booking_id and a valid decision are required" }, 400);
  }

  const expectedType = body.decision === "approve" ? "ticket_approved" : "payment_rejected";
  const { data: queued, error: queueError } = await admin
    .from("email_outbox")
    .select("id,notification_id,recipient_user_id,notification_type,status,attempts")
    .eq("booking_id", body.booking_id)
    .eq("notification_type", expectedType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (queueError) return json({ error: "Could not load email queue" }, 500);
  if (!queued) return json({ sent: false, status: "no_matching_notification" }, 404);
  if (queued.status === "sent") return json({ sent: true, status: "already_sent" });

  const { data: claimed, error: claimError } = await admin
    .from("email_outbox")
    .update({ status: "sending", attempts: Number(queued.attempts || 0) + 1, last_error: null })
    .eq("id", queued.id)
    .in("status", ["pending", "failed"])
    .select("id")
    .maybeSingle();

  if (claimError) return json({ error: "Could not claim email job" }, 500);
  if (!claimed) return json({ sent: false, status: "already_processing" }, 409);

  const { data: notification, error: notificationError } = await admin
    .from("notifications")
    .select("title,message,type")
    .eq("id", queued.notification_id)
    .maybeSingle();

  if (notificationError || !notification) {
    await admin.from("email_outbox").update({ status: "failed", last_error: "Notification not found" }).eq("id", queued.id);
    return json({ error: "Notification not found" }, 404);
  }

  const { data: recipient, error: recipientError } = await admin.auth.admin.getUserById(queued.recipient_user_id);
  const email = recipient?.user?.email;
  if (recipientError || !email) {
    await admin.from("email_outbox").update({ status: "failed", last_error: "Customer email is unavailable" }).eq("id", queued.id);
    return json({ error: "Customer email is unavailable" }, 422);
  }

  const approved = notification.type === "ticket_approved";
  const destination = approved ? `${appBaseUrl}/?tab=tickets` : `${appBaseUrl}/?tab=notifications`;
  const title = approved ? "تم تأكيد حجزك بنجاح" : "تحديث بخصوص طلب حجزك";
  const message = escapeHtml(notification.message).replace(/\n/g, "<br>");
  const buttonLabel = approved ? "عرض تذاكري" : "فتح إشعارات حاضر";
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"></head><body style="margin:0;background:#f6f3f8;font-family:Arial,Tahoma,sans-serif;color:#30213b"><div style="max-width:600px;margin:32px auto;padding:28px;background:#fff;border-radius:18px"><h2 style="color:#5b2e82;margin-top:0">حاضر HADDIR</h2><h1 style="font-size:23px">${title}</h1><p style="font-size:16px;line-height:2">${message}</p><p style="margin:28px 0"><a href="${destination}" style="display:inline-block;background:#5b2e82;color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:bold">${buttonLabel}</a></p><p style="font-size:12px;color:#807487">هذه رسالة آلية من منصة حاضر. لا ترد على هذا البريد.</p></div></body></html>`;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `haddir-notification-${queued.notification_id}`,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: title,
      html,
    }),
  });

  if (!resendResponse.ok) {
    const detail = await resendResponse.text();
    await admin.from("email_outbox").update({
      status: "failed",
      last_error: `Resend HTTP ${resendResponse.status}: ${detail.slice(0, 500)}`,
    }).eq("id", queued.id);
    return json({ sent: false, status: "failed", provider_status: resendResponse.status }, 502);
  }

  await admin.from("email_outbox").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null }).eq("id", queued.id);
  return json({ sent: true, status: "sent" });
});
