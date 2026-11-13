export type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type AssignedEvent = {
  event_id: string;
  events?: {
    title?: string;
    venue?: string;
    city?: string;
    starts_at?: string;
  };
};
