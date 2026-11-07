export type AdminReportRow = Record<string, any>;
export type AdminReportData = {
  events: AdminReportRow[];
  profiles: AdminReportRow[];
  bookings: AdminReportRow[];
  tickets: AdminReportRow[];
};
