"use client";

import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = { title: string; description?: string; action?: ReactNode; className?: string };

export function EmptyState({ title, description, action, className = "" }: EmptyStateProps) {
  return (
    <section className={["haddir-empty-state", className].filter(Boolean).join(" ")}>
      <span className="haddir-empty-icon" aria-hidden="true"><Inbox size={25} /></span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </section>
  );
}
