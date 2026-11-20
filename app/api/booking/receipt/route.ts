import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type ReceiptTimings = {
  authMs?: number;
  formDataMs?: number;
  storageUploadMs?: number;
};

function elapsedMs(startedAt: number) {
  return Number((performance.now() - startedAt).toFixed(1));
}

export async function POST(request: Request) {
  const requestStartedAt = performance.now();
  const timings: ReceiptTimings = {};
  let fileSizeBytes: number | null = null;

  const respond = (body: { error?: string; path?: string }, status: number, outcome: string) => {
    console.info(JSON.stringify({
      event: "performance.receipt_upload",
      outcome,
      function_region: process.env.VERCEL_REGION ?? null,
      status,
      duration_ms: elapsedMs(requestStartedAt),
      auth_ms: timings.authMs ?? null,
      form_data_ms: timings.formDataMs ?? null,
      storage_upload_ms: timings.storageUploadMs ?? null,
      file_size_bytes: fileSizeBytes,
      supabase_auth_requests: timings.authMs === undefined ? 0 : 1,
      storage_upload_requests: timings.storageUploadMs === undefined ? 0 : 1,
    }));
    return NextResponse.json(body, { status });
  };

  try {
    const authorization = request.headers.get("authorization") || "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return respond({ error: "انتهت جلسة الدخول. سجّل الدخول ثم أعد المحاولة." }, 401, "missing_authorization");
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return respond({ error: "خدمة رفع الإيصالات غير مهيأة حالياً." }, 503, "supabase_configuration_missing");
    }

    const authStartedAt = performance.now();
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    timings.authMs = elapsedMs(authStartedAt);
    if (authError || !authData.user) {
      return respond({ error: "تعذر التحقق من جلسة المستخدم. سجّل الدخول مجدداً." }, 401, "authentication_failed");
    }

    const formDataStartedAt = performance.now();
    const formData = await request.formData();
    timings.formDataMs = elapsedMs(formDataStartedAt);
    const bookingId = String(formData.get("bookingId") || "");
    const receipt = formData.get("receipt");

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingId)) {
      return respond({ error: "رقم الحجز غير صالح." }, 400, "invalid_booking_id");
    }
    if (!(receipt instanceof File)) {
      return respond({ error: "لم يتم استلام صورة الإيصال." }, 400, "receipt_missing");
    }
    fileSizeBytes = receipt.size;
    if (!ALLOWED_TYPES.has(receipt.type)) {
      return respond({ error: "الصيغ المدعومة: JPG أو PNG أو WebP." }, 400, "unsupported_file_type");
    }
    if (receipt.size <= 0 || receipt.size > MAX_RECEIPT_SIZE) {
      return respond({ error: "حجم الإيصال يجب ألا يتجاوز 5 ميجابايت." }, 400, "invalid_file_size");
    }

    const extension = receipt.type === "image/png" ? "png" : receipt.type === "image/webp" ? "webp" : "jpg";
    const path = `${authData.user.id}/${bookingId}/${crypto.randomUUID()}.${extension}`;
    const storageStartedAt = performance.now();
    const { error: uploadError } = await supabase.storage
      .from("payment-receipts")
      .upload(path, receipt, { contentType: receipt.type, upsert: false, cacheControl: "3600" });
    timings.storageUploadMs = elapsedMs(storageStartedAt);

    if (uploadError) {
      return respond(
        { error: "تعذر رفع الإيصال. حاول مرة أخرى." },
        String(uploadError.statusCode) === "403" ? 403 : 502,
        "storage_upload_failed",
      );
    }

    return respond({ path }, 200, "success");
  } catch {
    return respond({ error: "تعذر إكمال رفع الإيصال عبر الخادم. حاول مرة أخرى." }, 502, "unexpected_error");
  }
}
