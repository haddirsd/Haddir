import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "يلزم تسجيل الدخول من جديد." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "خدمة حذف الحساب غير مهيأة." }, 503);

  const userClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user?.id || !user.email) return json({ error: "انتهت جلسة الدخول. سجّل الدخول مرة أخرى." }, 401);

  let body: { confirm_email?: string };
  try { body = await req.json(); } catch { return json({ error: "طلب غير صالح." }, 400); }
  if (typeof body.confirm_email !== "string" || body.confirm_email.trim().toLowerCase() !== user.email.toLowerCase()) {
    return json({ error: "البريد الإلكتروني غير مطابق للحساب." }, 400);
  }

  const { data: profile, error: profileError } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError) return json({ error: "تعذر التحقق من صلاحيات الحساب." }, 500);
  if (!profile || profile.role !== "customer") {
    return json({ error: "حذف الحساب ذاتياً متاح لحسابات العملاء فقط. تواصل مع إدارة حاضر لإغلاق حسابات العمل." }, 403);
  }

  const [createdEvents, assignments, scans, bookings] = await Promise.all([
    admin.from("events").select("id").eq("created_by", user.id).limit(1),
    admin.from("event_role_assignments").select("event_id").eq("user_id", user.id).limit(1),
    admin.from("gatekeeper_scan_logs").select("id").eq("gatekeeper_user_id", user.id).limit(1),
    admin.from("bookings").select("id,status,events(starts_at)").eq("user_id", user.id),
  ]);
  if (createdEvents.error || assignments.error || scans.error || bookings.error) {
    return json({ error: "تعذر فحص ارتباطات الحساب. لم يتم حذف أي بيانات." }, 500);
  }
  if (createdEvents.data?.length || assignments.data?.length || scans.data?.length) {
    return json({ error: "الحساب مرتبط بمهام أو فعاليات على المنصة. تواصل مع الإدارة قبل حذفه." }, 409);
  }

  const hasUpcomingConfirmedTicket = (bookings.data || []).some((booking: any) => booking.status === "confirmed" && booking.events?.starts_at && new Date(booking.events.starts_at).getTime() > Date.now());
  if (hasUpcomingConfirmedTicket) return json({ error: "لديك تذكرة مؤكدة لفعالية لم تبدأ بعد. احتفظ بحسابك حتى تحضر الفعالية أو تواصل مع الدعم قبل الحذف." }, 409);

  const bookingIds = (bookings.data || []).map((row) => row.id);
  if (bookingIds.length) {
    const { data: receipts, error: receiptsError } = await admin.from("payment_submissions")
      .select("receipt_path").in("booking_id", bookingIds).not("receipt_path", "is", null);
    if (receiptsError) return json({ error: "تعذر تجهيز ملفات إيصالات الدفع للحذف." }, 500);
    const paths = [...new Set((receipts || []).map((row) => row.receipt_path).filter((path): path is string => typeof path === "string" && path.length > 0))];
    if (paths.length) {
      const { error: storageError } = await admin.storage.from("payment-receipts").remove(paths);
      if (storageError) return json({ error: "تعذر حذف إيصالات التحويل بأمان. لم يتم إغلاق الحساب." }, 500);
    }
  }

  const cleanupSteps = [
    await admin.from("email_outbox").delete().eq("recipient_user_id", user.id),
    await admin.from("notifications").delete().eq("user_id", user.id),
    await admin.from("push_subscriptions").delete().eq("user_id", user.id),
    await admin.from("payment_submissions").update({ submitted_by: null, receipt_path: null }).eq("submitted_by", user.id),
    await admin.from("bookings").update({
      user_id: null,
      customer_name: "مستخدم محذوف",
      customer_email: null,
      customer_phone: "محذوف",
    }).eq("user_id", user.id),
  ];
  const failed = cleanupSteps.find((result) => result.error);
  if (failed?.error) {
    return json({ error: "تعذر إكمال إزالة بيانات الحساب. لم يتم حذف تسجيل الدخول؛ تواصل مع الدعم قبل إعادة المحاولة." }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false);
  if (deleteError) {
    return json({ error: "تمت إزالة بيانات الملف الشخصي وإيصالات الدفع، لكن تعذر إغلاق تسجيل الدخول. تواصل مع الدعم لإكمال العملية." }, 500);
  }

  return json({ success: true, message: "تم حذف الحساب وإزالة بياناته الشخصية." });
});
