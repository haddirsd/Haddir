export type AdminReportRow = Record<string, any>;
export type AdminReportData = {
  events: AdminReportRow[];
  profiles: Record<string, number>;
  bookings: Record<string, any>;
  tickets: Record<string, any>;
  eventMetrics: AdminReportRow[];
};
export type AdminEventReportPage = {
  bookings: AdminReportRow[];
  tickets: AdminReportRow[];
  bookingTotal: number;
  ticketTotal: number;
};
