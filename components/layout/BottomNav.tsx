"use client";

import { Bell, House, Ticket, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Tab = "home" | "tickets" | "notifications" | "profile";
type BottomNavProps = {
  activeTab: Tab;
  unreadCount?: number;
  onNavigate: (tab: Tab) => void;
};

const items: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "الرئيسية", icon: House },
  { id: "tickets", label: "تذاكري", icon: Ticket },
  { id: "notifications", label: "الإشعارات", icon: Bell },
  { id: "profile", label: "الملف الشخصي", icon: UserRound },
];

export function BottomNav({ activeTab, unreadCount = 0, onNavigate }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="التنقل الرئيسي">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-current={activeTab === id ? "page" : undefined}
          aria-label={label}
          className={activeTab === id ? "selected" : ""}
          onClick={() => onNavigate(id)}
        >
          {id === "notifications" ? (
            <span className="nav-icon-wrap">
              <Icon size={21} />
              {unreadCount > 0 && <i className="nav-notification-dot" aria-label={`${unreadCount} إشعارات غير مقروءة`} />}
            </span>
          ) : <Icon size={21} />}
          <span className="nav-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
