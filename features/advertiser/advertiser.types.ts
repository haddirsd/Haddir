export type AdvertiserEventSummary = {
  id: string;
  title: string;
  venue: string | null;
  city: string | null;
  starts_at: string | null;
  platform_fee_percent: number | string;
};
export type AdvertiserTotals = {
  bookers: number;
  confirmed_bookings: number;
  rejected_bookings: number;
  confirmed_tickets: number;
  rejected_tickets: number;
};
export type AdvertiserFinancialLine = {
  currency: string;
  sales: number | string;
  platform_fee: number | string;
  advertiser_net: number | string;
};
export type AdvertiserTicketLine = {
  id: string;
  name: string;
  currency: string;
  quantity_total: number;
  confirmed_quantity: number;
  reserved_quantity: number;
  rejected_quantity: number;
  remaining_quantity: number;
  sales: number | string;
};
export type AdvertiserStatistics = {
  event: AdvertiserEventSummary;
  totals: AdvertiserTotals;
  financials: AdvertiserFinancialLine[];
  ticket_types: AdvertiserTicketLine[];
};
