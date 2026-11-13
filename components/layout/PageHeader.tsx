"use client";

import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  icon?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

export function PageHeader({ title, icon, leading, trailing, className = "" }: PageHeaderProps) {
  return (
    <header className={["screen-topbar", className].filter(Boolean).join(" ")}>
      {leading ?? <span className="screen-topbar-spacer" aria-hidden="true" />}
      <strong>{title}</strong>
      {icon && <span className="screen-icon">{icon}</span>}
      {trailing}
    </header>
  );
}
