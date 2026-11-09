export type AdminEventRole = "owner" | "admin" | "supervisor";
export type AdminEventRow = {
  id: string;
  title: string;
  category: string | null;
  city: string | null;
  venue: string | null;
  starts_at: string | null;
  is_continuous: boolean;
  status: string;
  created_at: string;
  is_trending: boolean;
  description: string | null;
  address: string | null;
  location_url: string | null;
  ends_at: string | null;
  cover_image_url: string | null;
  platform_fee_percent: number | string | null;
};
export type AdminTicketForm = {
  id?: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  quantity_total: string;
  quantity_sold: number;
  sales_start_at: string;
  sales_end_at: string;
  is_active: boolean;
};
export type AdminEventAccountForm = {
  id?: string;
  account_name: string;
  account_number: string;
  beneficiary: string;
  is_active: boolean;
  sort_order: number;
};
export type AdminEventFormValues = {
  title: string;
  description: string;
  category: string;
  city: string;
  venue: string;
  address: string;
  location_url: string;
  starts_at: string;
  ends_at: string;
  is_continuous: boolean;
  cover_image_url: string;
  is_trending: boolean;
  platform_fee_percent: string;
};
export type AdminEventEditorData = {
  tickets: AdminTicketForm[];
  paymentAccounts: AdminEventAccountForm[];
};
