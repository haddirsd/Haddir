import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";

export async function signInWithGoogle(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return "إعدادات تسجيل الدخول غير مكتملة على الموقع.";

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  return error?.message ?? null;
}

export async function signOutUser(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { error } = await supabase.auth.signOut();
  return error ? "تعذر تسجيل الخروج حالياً. حاول مرة أخرى." : null;
}

export async function updateCustomerPhone(userId: string, phone: string): Promise<{ phone: string | null; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { phone: null, error: "تعذر الاتصال بقاعدة البيانات حالياً." };

  const { data, error } = await supabase
    .from("profiles")
    .update({ phone })
    .eq("id", userId)
    .select("phone")
    .single();

  if (error) return { phone: null, error: "ما قدرنا نحفظ رقمك. تأكد من الاتصال وحاول مرة تانية." };
  return { phone: data?.phone ?? phone, error: null };
}
