"use client";

import type { ReactNode } from "react";
import { Bell, Ticket, UserRound, ChevronLeft, ScanLine, ShieldCheck, Sun, Moon } from "lucide-react";
import { PageHeader } from "./PageHeader";

type AppTab = "home" | "tickets" | "notifications" | "profile";

type AppHeaderProps = {
  activeTab: AppTab;
  darkMode: boolean;
  isEventDetailOpen: boolean;
  isGatekeeperPage: boolean;
  showPrivacySecurity: boolean;
  onGoHome: () => void;
  onToggleTheme: () => void;
  onBackFromPrivacy: () => void;
  onBackFromGatekeeper: () => void;
};

export function AppHeader({
  activeTab,
  darkMode,
  isEventDetailOpen,
  isGatekeeperPage,
  showPrivacySecurity,
  onGoHome,
  onToggleTheme,
  onBackFromPrivacy,
  onBackFromGatekeeper,
}: AppHeaderProps) {
  if (isEventDetailOpen) return null;

  if (showPrivacySecurity && !isGatekeeperPage) {
    return (
      <header className="screen-topbar privacy-screen-topbar">
        <button type="button" className="privacy-back-button" onClick={onBackFromPrivacy}>
          <ChevronLeft size={18} /> رجوع
        </button>
        <strong>الخصوصية والأمان</strong>
        <span className="screen-icon"><ShieldCheck /></span>
      </header>
    );
  }

  if (isGatekeeperPage) {
    return (
      <header className="screen-topbar gatekeeper-page-topbar">
        <button type="button" className="btn btn-outline" onClick={onBackFromGatekeeper}>
          العودة للملف الشخصي
        </button>
        <strong>مسح التذاكر</strong>
        <span className="screen-icon"><ScanLine /></span>
      </header>
    );
  }

  if (activeTab === "home") {
    return (
      <header className="topbar">
        <div className="container header-inner">
          <button className="brand brand-button" onClick={onGoHome}>
            <img
              className="brand-logo"
              src={darkMode ? "/dark.svg?v=20261111-home-logo" : "/light.svg?v=20261111-home-logo"}
              alt="حاضر"
            />
          </button>
          <div className="desktop-greeting">من السودان، لكل لحظة تستاهل الحضور.</div>
          <button
            className="header-icon theme-toggle"
            type="button"
            aria-label={darkMode ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي"}
            aria-pressed={darkMode}
            title={darkMode ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي"}
            onClick={onToggleTheme}
          >
            <span className="theme-toggle-track" aria-hidden="true">
              <span className="theme-toggle-knob">
                {darkMode ? <Sun size={17} strokeWidth={2.3} /> : <Moon size={16} strokeWidth={2.3} />}
              </span>
            </span>
          </button>
        </div>
      </header>
    );
  }

  const titles: Record<Exclude<AppTab, "home">, string> = {
    tickets: "تذاكري",
    notifications: "الإشعارات",
    profile: "الملف الشخصي",
  };

  return (
    <PageHeader
      title={titles[activeTab]}
      icon={activeTab === "tickets" ? <Ticket /> : activeTab === "notifications" ? <Bell /> : <UserRound />}
    />
  );
}
