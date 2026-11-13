import { getSupabaseBrowserClient } from "../../../lib/supabase";
import type { AdvertiserStatistics } from "../types";

export async function getAdvertiserEventStatistics(): Promise<{ data: AdvertiserStatistics | null; error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: null, error: "تعذر الاتصال بقاعدة البيانات حالياً." };
  const { data, error } = await supabase.rpc("get_advertiser_event_statistics");
  if (error) return { data: null, error: error.message || "تعذر تحميل إحصائيات الفعالية." };
  if (!data?.event) return { data: null, error: "ما لقينا فعالية مرتبطة بحسابك." };
  return { data: data as AdvertiserStatistics, error: null };
}
