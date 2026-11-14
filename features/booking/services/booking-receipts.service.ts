import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";

type ServiceError = { message?: string } | null;

export async function uploadPaymentReceipt(userId: string, bookingId: string, receipt: File): Promise<{ path: string | null; error: ServiceError }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { path: null, error: { message: "تعذر الاتصال بقاعدة البيانات." } };

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) {
    return { path: null, error: { message: "انتهت جلسة الدخول. سجّل الدخول ثم أعد المحاولة." } };
  }

  try {
    const formData = new FormData();
    formData.set("bookingId", bookingId);
    formData.set("receipt", receipt, receipt.name || "receipt");
    const response = await fetch("/api/booking/receipt", {
      method: "POST",
      headers: { Authorization: "Bearer " + accessToken },
      body: formData,
    });
    const result = await response.json().catch(() => null) as { path?: string; error?: string } | null;
    if (!response.ok || !result?.path) {
      return { path: null, error: { message: result?.error || "تعذر رفع الإيصال (HTTP " + response.status + ")." } };
    }
    return { path: result.path, error: null };
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
