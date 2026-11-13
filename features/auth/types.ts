"use client";

export type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type AssignedEvent = {
  event_id: string;
  assignment_role: string;
  events?: {
    id: string;
    title: string;
    venue?: string | null;
    city?: string | null;
    starts_at?: string | null;
    status?: string | null;
  } | null;
};
