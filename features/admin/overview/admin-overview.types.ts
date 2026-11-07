export type AdminOverviewRole = "owner" | "admin" | "supervisor";
export type AdminOverviewStats = {
  events: number;
  bookings: number;
  pending: number;
  users: number;
  confirmed: number;
  revenue: number;
};
