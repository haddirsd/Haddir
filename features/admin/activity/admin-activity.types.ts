export type AdminActivityRow = {
  id: string;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string | null;
  entity_label: string | null;
  event_id: string | null;
  booking_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  events?: { title?: string } | null;
};
