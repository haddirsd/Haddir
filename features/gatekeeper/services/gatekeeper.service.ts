import { getSupabaseBrowserClient } from "../../../lib/supabase";
import type { GatekeeperScanHistoryItem, GatekeeperScanStats, GatekeeperEntryMethod } from "../types";

type ServiceError = { message?: string } | null;

export async function getGatekeeperScanStats(eventId: string): Promise<{ data: GatekeeperScanStats | null; error: ServiceError }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: null, error: { message: "تعذر الاتصال بقاعدة البيانات." } };
  const { data, error } = await supabase.rpc("get_gatekeeper_scan_stats", { p_event_id: eventId });
  return { data: (data as GatekeeperScanStats | null) ?? null, error };
}

export async function getGatekeeperScanHistory(eventId: string): Promise<{ data: GatekeeperScanHistoryItem[] | null; error: ServiceError }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: null, error: { message: "تعذر الاتصال بقاعدة البيانات." } };
  const { data, error } = await supabase.rpc("get_gatekeeper_scan_history", { p_event_id: eventId });
  return { data: (data as GatekeeperScanHistoryItem[] | null) ?? null, error };
}

export async function submitGatekeeperTicketAction(
  ticketCode: string,
  confirm: boolean,
  entryMethod: GatekeeperEntryMethod = "qr",
): Promise<{ data: unknown; error: ServiceError }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { data: null, error: { message: "تعذر الاتصال بقاعدة البيانات." } };
  const rpcName = entryMethod === "manual" ? "gatekeeper_manual_ticket_action" : "gatekeeper_ticket_action";
  const { data, error } = await supabase.rpc(rpcName, { p_ticket_code: ticketCode, p_confirm: confirm });
  return { data, error };
}
