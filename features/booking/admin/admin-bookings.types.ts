export type AdminBookingRow = {
  id: string;
  booking_number: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  event_id: string;
  subtotal: number | string;
  currency: string;
  status: string;
  expires_at: string | null;
  created_at: string;
  events?: { title?: string; city?: string; venue?: string; starts_at?: string } | null;
  booking_items?: Array<{ quantity: number; unit_price: number; line_total: number; ticket_types?: { name?: string } | null }>;
  payment_submissions?: Array<{
    id: string;
    payment_account_name: string | null;
    payment_account_number: string | null;
    payment_account_beneficiary: string | null;
    transfer_reference: string | null;
    receipt_path: string | null;
    receipt_url?: string | null;
    status: string;
    created_at: string;
  }>;
};
export type AdminBookingsResult = { rows: AdminBookingRow[]; error: string | null };
