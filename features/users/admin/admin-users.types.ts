export type AdminUsersRole = "owner" | "admin" | "supervisor";
export type AdminUserRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  created_at: string;
  assignment_event_id?: string;
};
export type AdminUserEventOption = { id: string; title: string; status: string };
export type AdminUsersResult = {
  rows: AdminUserRow[];
  eventOptions: AdminUserEventOption[];
  total: number;
  error: string | null;
};
