import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";

type ServiceError = { message?: string } | null;

const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function uploadPaymentReceipt(userId: string, bookingId: string, receipt: File): Promise<{ path: string | null; error: ServiceError }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { path: null, error: { message: "تعذر الاتصال بقاعدة البيانات." } };

  if (!(receipt instanceof File) || receipt.size <= 0) {
    return { path: null, error: { message: "اختر صورة إيصال صالحة." } };
  }
  if (!ALLOWED_TYPES.has(receipt.type)) {
    return { path: null, error: { message: "الصيغ المدعومة: JPG أو PNG أو WebP." } };
  }
  if (receipt.size > MAX_RECEIPT_SIZE) {
    return { path: null, error: { message: "حجم الإيصال يجب ألا يتجاوز 5 ميجابايت." } };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (sessionError || !session?.access_token) {
    return { path: null, error: { message: "انتهت جلسة الدخول. سجّل الدخول ثم أعد المحاولة." } };
  }
  if (session.user.id !== userId) {
    return { path: null, error: { message: "لا تملك صلاحية رفع إيصال لهذا الحساب." } };
  }

  const extension = receipt.type === "image/png" ? "png" : receipt.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${bookingId}/${crypto.randomUUID()}.${extension}`;

  try {
    const { error } = await supabase.storage
      .from("payment-receipts")
      .upload(path, receipt, {
        contentType: receipt.type,
        upsert: false,
        cacheControl: "3600",
      });

    if (error) {
      console.error("Receipt Storage upload failed:", {
        message: error.message,
        name: error.name,
        statusCode: error.statusCode,
      });
      return {
        path: null,
        error: {
          message: error.statusCode === "413"
            ? "حجم الإيصال أكبر من الحد المسموح به وهو 5 ميجابايت."
            : "تعذر رفع الإيصال. تحقق من اتصال الإنترنت وصلاحية الحجز ثم أعد المحاولة.",
        },
      };
    }
    return { path, error: null };
  } catch (error) {
    console.error("Receipt upload request failed:", error);
    return {
      path: null,
      error: { message: "تعذر الاتصال بخدمة رفع الإيصالات. تأكد من اتصال الإنترنت ثم أعد المحاولة؛ حجزك محفوظ." },
    };
  }
}

export async function removePaymentReceipt(path: string): Promise<{ error: ServiceError }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: { message: "تعذر الاتصال بقاعدة البيانات." } };
  const { error } = await supabase.storage.from("payment-receipts").remove([path]);
  return { error };
}
