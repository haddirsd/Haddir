"use client";

import { LoaderCircle } from "lucide-react";

type LoadingStateProps = { label?: string; className?: string; compact?: boolean };

export function LoadingState({ label = "جاري التحميل...", className = "", compact = false }: LoadingStateProps) {
  return (
    <div className={["haddir-loading-state", compact ? "is-compact" : "", className].filter(Boolean).join(" ")} role="status" aria-live="polite">
      <LoaderCircle className="haddir-loading-spinner" size={compact ? 18 : 26} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
