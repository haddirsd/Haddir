import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return NextResponse.json({ error: "انتهت جلسة الدخول. سجّل الدخول ثم أعد المحاولة." }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.error("Receipt upload: Supabase server configuration is missing.");
      return NextResponse.json({ error: "خدمة رفع الإيصالات غير مهيأة حالياً." }, { status: 503 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return NextResponse.json({ error: "تعذر التحقق من جلسة المستخدم. سجّل الدخول مجدداً." }, { status: 401 });
    }

    const formData = await request.formData();
    const bookingId = String(formData.get("bookingId") || "");
    const receipt = formData.get("receipt");

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingId)) {
      return NextResponse.json({ error: "رقم الحجز غير صالح." }, { status: 400 });
    }
    if (!(receipt instanceof File)) {
      return NextResponse.json({ error: "لم يتم استلام صورة الإيصال." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(receipt.type)) {
      return NextResponse.json({ error: "الصيغ المدعومة: JPG أو PNG أو WebP." }, { status: 400 });
    }
    if (receipt.size <= 0 || receipt.size > MAX_RECEIPT_SIZE) {
      return NextResponse.json({ error: "حجم الإيصال يجب ألا يتجاوز 5 ميجابايت." }, { status: 400 });
    }

    const extension = receipt.type === "image/png" ? "png" : receipt.type === "image/webp" ? "webp" : "jpg";
    const path = `${authData.user.id}/${bookingId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("payment-receipts")
      .upload(path, receipt, { contentType: receipt.type, upsert: false, cacheControl: "3600" });

    if (uploadError) {
      console.error("Receipt upload failed:", uploadError.message, uploadError.statusCode);
      return NextResponse.json({ error: uploadError.message || "رفضت خدمة التخزين رفع الإيصال." }, { status:  uploadError.statusCode === "403" ? 403 : 502 });
    }

    return NextResponse.json({ path });
  } catch (error) {
    console.error("Receipt upload route failed:", error);
    return NextResponse.json({ error: "تعذر إكمال رفع الإيصال عبر الخادم. حاول مرة أخرى." }, { status: 502 });
  }
}
