import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";

type ServiceError = { message?: string } | null;

export async function submitPayment(bookingId: string, paymentMethodId: string, receiptPath: string): Promise<{ data: string | null; error: ServiceError }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: null, error: { message: "تعذر الاتصال بقاعدة البيانات." } };
  const { data, error } = await supabase.rpc("submit_payment", {
    p_booking_id: bookingId, p_payment_method_id: paymentMethodId,
    p_receipt_path: receiptPath, p_transfer_reference: null,
  });
  return { data: (data as string | null) ?? null, error };
}
