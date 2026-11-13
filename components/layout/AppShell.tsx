"use client";

import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  darkMode?: boolean;
  className?: string;
};

export function AppShell({ children, darkMode = false, className = "" }: AppShellProps) {
  const classes = ["app-shell", darkMode ? "theme-dark" : "", className].filter(Boolean).join(" ");
  return (
    <main dir="rtl" lang="ar" className={classes}>
      {children}
    </main>
  );
}
