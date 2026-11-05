export type GatekeeperEntryMethod = "qr" | "manual";

export type GatekeeperScanStats = {
  accepted: number;
  used: number;
  forged: number;
  invalid: number;
};

export type GatekeeperScanHistoryItem = {
  id: string;
  ticket_code: string | null;
  outcome: "accepted" | "used" | "forged" | "invalid" | string;
  scanned_at: string;
  ticket_id: string | null;
  entry_method: GatekeeperEntryMethod;
  gatekeeper_name: string | null;
};

export type GatekeeperTicketActionResult = {
  ok?: boolean;
  status?: string;
  message?: string;
  ticket_code?: string;
  buyer_name?: string;
  attendee_name?: string;
  event_title?: string;
  ticket_type?: string;
  attendee_count?: number;
};
