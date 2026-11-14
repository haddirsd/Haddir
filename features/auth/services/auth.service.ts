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

export async function updateCustomerProfile(userId: string, fullName: string, phone: string): Promise<{ fullName: string | null; phone: string | null; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { fullName: null, phone: null, error: "تعذر الاتصال بقاعدة البيانات حالياً." };

  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: fullName.trim(), phone })
    .eq("id", userId)
    .select("full_name,phone")
    .single();

  if (error) return { fullName: null, phone: null, error: "ما قدرنا نحفظ بياناتك. تأكد من الاتصال وحاول مرة تانية." };
  return { fullName: data?.full_name ?? fullName.trim(), phone: data?.phone ?? phone, error: null };
}
