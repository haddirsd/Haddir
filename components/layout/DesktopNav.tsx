"use client";

import { Bell, House, Ticket, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Tab = "home" | "tickets" | "notifications" | "profile";

type DesktopNavProps = {
  activeTab: Tab;
  unreadCount?: number;
  ticketCount?: number;
  darkMode: boolean;
  onNavigate: (tab: Tab) => void;
  className?: string;
};

const items: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "الرئيسية", icon: House },
  { id: "tickets", label: "تذاكري", icon: Ticket },
  { id: "notifications", label: "الإشعارات", icon: Bell },
  { id: "profile", label: "الملف الشخصي", icon: UserRound },
];

export function DesktopNav({
  activeTab,
  unreadCount = 0,
  ticketCount = 0,
  darkMode,
  onNavigate,
  className = "",
}: DesktopNavProps) {
  return (
    <nav
      className={["desktop-nav", className].filter(Boolean).join(" ")}
      aria-label="التنقل الرئيسي"
    >
      <div className="desktop-nav-brand">
        <button type="button" onClick={() => onNavigate("home")} aria-label="حاضر - الرئيسية">
          <img src={darkMode ? "/dark.svg" : "/light.svg"} alt="حاضر" />
        </button>
      </div>

      <div className="desktop-nav-items">
        {items.map(({ id, label, icon: Icon }) => {
          const count = id === "tickets" ? ticketCount : id === "notifications" ? unreadCount : 0;
          return (
            <button
              key={id}
              type="button"
              aria-current={activeTab === id ? "page" : undefined}
              aria-label={label}
              className={activeTab === id ? "selected" : ""}
              onClick={() => onNavigate(id)}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="nav-label">{label}</span>
              {count > 0 && <span className="nav-count">{count > 99 ? "99+" : count}</span>}
            </button>
          );
        })}
      </div>

      <div className="desktop-nav-footer">من السودان، لكل لحظة تستاهل الحضور.</div>
    </nav>
  );
}
