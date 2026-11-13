export type AdminRole = "owner" | "admin" | "supervisor";

export type AdminSection =
  | "overview"
  | "events"
  | "bookings"
  | "payments"
  | "users"
  | "reports"
  | "activity";

export const ADMIN_SECTION_LABELS: Record<AdminSection, string> = {
  overview: "نظرة عامة",
  events: "الفعاليات",
  bookings: "الحجوزات",
  payments: "مراجعة المدفوعات",
  users: "المستخدمون",
  reports: "الإحصائيات",
  activity: "سجل الإجراءات",
};

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  owner: "مالك المنصة",
  admin: "المشرف الإداري",
  supervisor: "موظف حاضر",
};

export function getAdminNavigationSections(role: AdminRole): AdminSection[] {
  return role === "supervisor"
    ? ["overview", "bookings", "payments"]
    : ["overview", "events", "bookings", "payments", "users", "reports", "activity"];
}
