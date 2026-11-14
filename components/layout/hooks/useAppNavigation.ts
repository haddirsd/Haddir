"use client";

import { useEffect, useState } from "react";

export type AppTab = "home" | "tickets" | "notifications" | "profile";
type AppWorkspace = "customer" | "organizer" | "gatekeeper" | "advertiser" | "admin" | "owner" | null;

export function useAppNavigation() {
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [showPrivacySecurity, setShowPrivacySecurity] = useState(false);
  const [eventResetKey, setEventResetKey] = useState(0);
  const [activeWorkspace, setActiveWorkspace] = useState<AppWorkspace>(null);
  const [isGatekeeperPage, setIsGatekeeperPage] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "tickets" || tab === "notifications" || tab === "profile") {
      setActiveTab(tab);
    }
    if (params.get("workspace") === "gatekeeper") {
      setActiveWorkspace("gatekeeper");
      setIsGatekeeperPage(true);
    }
  }, []);

  const go = (tab: AppTab) => {
    setShowPrivacySecurity(false);
    setEventResetKey((value) => value + 1);
    setActiveTab(tab);

    const url = new URL(window.location.href);
    if (tab === "home") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    url.searchParams.delete("workspace");

    setIsGatekeeperPage(false);
    setActiveWorkspace(null);
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  const backFromGatekeeper = () => {
    setIsGatekeeperPage(false);
    setActiveWorkspace(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("workspace");
    window.location.assign(url.pathname + url.search + url.hash);
  };

  const closeGatekeeper = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("workspace");
    url.searchParams.set("tab", "profile");
    window.location.assign(url.pathname + url.search + url.hash);
  };

  return {
    activeTab,
    setActiveTab,
    showPrivacySecurity,
    setShowPrivacySecurity,
    eventResetKey,
    setEventResetKey,
    activeWorkspace,
    isGatekeeperPage,
    setIsGatekeeperPage,
    go,
    backFromGatekeeper,
    closeGatekeeper,
  };
}
