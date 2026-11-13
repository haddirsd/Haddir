export type CustomerTicket = {
  id: string;
  status: string;
  ticket_code: string;
  events?: { title?: string; starts_at?: string; is_continuous?: boolean; venue?: string; cover_image_url?: string | null } | null;
  ticket_types?: { name?: string } | null;
  bookings?: { booking_number?: string; user_id?: string } | null;
  booking_items?: { quantity?: number } | null;
};

export type CustomerNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  booking_id?: string | null;
};
