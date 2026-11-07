export type AdminPaymentRow = {
  id: string;
  booking_id: string;
  transfer_reference: string | null;
  receipt_path: string | null;
  receipt_url: string | null;
  amount: number | string;
  currency: string;
  status: string;
  review_note: string | null;
  created_at: string;
  payment_account_id: string | null;
  payment_account_name: string | null;
  payment_account_number: string | null;
  payment_account_beneficiary: string | null;
  bookings?: {
    booking_number?: string;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    subtotal?: number | string;
    currency?: string;
    events?: { title?: string; city?: string; venue?: string; starts_at?: string } | null;
    booking_items?: Array<{ quantity: number; ticket_types?: { name?: string } | null }>;
  } | null;
};
export type AdminPaymentDecision = "approve" | "reject";
export type AdminPaymentReviewResult = { bookingId: string | null; ticketsCreated: number };
