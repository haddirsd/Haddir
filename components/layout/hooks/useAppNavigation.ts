"use client";

import { useCallback, useEffect, useState } from "react";

export type AppTab = "home" | "tickets" | "notifications" | "profile";
type AppWorkspace = "customer" | "organizer" | "gatekeeper" | "advertiser" | "admin" | "owner" | null;
type HaddirHistoryState = { __haddirApp?: boolean; __haddirLegal?: boolean; tab?: AppTab; workspace?: string; haddirPage?: string };

const LEGAL_HISTORY_KEY = "__haddirLegal";

function isAppTab(value: unknown): value is AppTab {
  return value === "home" || value === "tickets" || value === "notifications" || value === "profile";
}

export function useAppNavigation() {
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [showPrivacySecurity, setShowPrivacySecurityState] = useState(false);
  const [eventResetKey, setEventResetKey] = useState(0);
  const [activeWorkspace, setActiveWorkspace] = useState<AppWorkspace>(null);
  const [isGatekeeperPage, setIsGatekeeperPage] = useState(false);

  useEffect(() => {
    const initialUrl = new URL(window.location.href);
    const tabParam = initialUrl.searchParams.get("tab");
    const initialTab: AppTab = isAppTab(tabParam) ? tabParam : "home";
    const legalInitiallyOpen = initialUrl.searchParams.get("legal") === "1";
    const workspace = initialUrl.searchParams.get("workspace");

    setActiveTab(initialTab);

    // Give the in-app screens a real history entry so Android Back returns
    // to the previous Haddir screen instead of immediately leaving the site.
    const homeUrl = new URL(initialUrl);
    homeUrl.searchParams.delete("tab");
    homeUrl.searchParams.delete("legal");
    homeUrl.searchParams.delete("workspace");
    window.history.replaceState(
      { __haddirApp: true, tab: "home" } satisfies HaddirHistoryState,
      "",
      homeUrl.pathname + homeUrl.search + homeUrl.hash,
    );

    const tabUrl = new URL(initialUrl);
    tabUrl.searchParams.delete("legal");
    tabUrl.searchParams.delete("workspace");
    tabUrl.searchParams.delete("event");
    tabUrl.searchParams.delete("checkout");
    tabUrl.searchParams.delete("tier");
    tabUrl.searchParams.delete("qty");

    if (initialTab !== "home") {
      window.history.pushState(
        { __haddirApp: true, tab: initialTab } satisfies HaddirHistoryState,
        "",
        tabUrl.pathname + tabUrl.search + tabUrl.hash,
      );
    }

    if (workspace) {
      window.history.pushState(
        { __haddirApp: true, tab: initialTab, workspace } satisfies HaddirHistoryState,
        "",
        (() => {
          const url = new URL(tabUrl);
          url.searchParams.set("workspace", workspace);
          return url.pathname + url.search + url.hash;
        })(),
      );
    }

    if (initialUrl.searchParams.has("event")) {
      window.history.pushState(
        {
          __haddirApp: true,
          tab: initialTab,
          haddirPage: initialUrl.searchParams.get("checkout") === "1" ? "event-payment" : "event-detail",
        } satisfies HaddirHistoryState,
        "",
        (() => {
          const url = new URL(initialUrl);
          url.searchParams.delete("legal");
          return url.pathname + url.search + url.hash;
        })(),
      );
    }
    if (workspace === "gatekeeper") {
      setActiveWorkspace("gatekeeper");
      setIsGatekeeperPage(true);
    }

    if (legalInitiallyOpen) {
      window.history.pushState(
        { __haddirApp: true, __haddirLegal: true, tab: initialTab } satisfies HaddirHistoryState,
        "",
        initialUrl.pathname + initialUrl.search + initialUrl.hash,
      );
      setShowPrivacySecurityState(true);
    }
  }, []);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = (event.state ?? {}) as HaddirHistoryState;
      setShowPrivacySecurityState(Boolean(state[LEGAL_HISTORY_KEY]));
      if (state.__haddirApp) {
        setActiveTab(isAppTab(state.tab) ? state.tab : "home");
        if (state.workspace === "gatekeeper") {
          setActiveWorkspace("gatekeeper");
          setIsGatekeeperPage(true);
        } else {
          setActiveWorkspace(null);
          setIsGatekeeperPage(false);
        }
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const setShowPrivacySecurity = useCallback((visible: boolean) => {
    if (visible) {
      if (!showPrivacySecurity) {
        const current = (window.history.state ?? {}) as HaddirHistoryState;
        window.history.pushState(
          { ...current, __haddirApp: true, __haddirLegal: true, tab: activeTab },
          "",
          window.location.href,
        );
      }
      setShowPrivacySecurityState(true);
      return;
    }

    if ((window.history.state as HaddirHistoryState | null)?.[LEGAL_HISTORY_KEY]) {
      window.history.back();
    } else {
      setShowPrivacySecurityState(false);
    }
  }, [activeTab, showPrivacySecurity]);

  const go = (tab: AppTab) => {
    setShowPrivacySecurityState(false);
    setEventResetKey((value) => value + 1);
    setActiveTab(tab);

    const url = new URL(window.location.href);
    if (tab === "home") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    url.searchParams.delete("workspace");
    url.searchParams.delete("legal");

    setIsGatekeeperPage(false);
    setActiveWorkspace(null);
    window.history.pushState(
      { __haddirApp: true, tab } satisfies HaddirHistoryState,
      "",
      url.pathname + url.search + url.hash,
    );
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  const backFromGatekeeper = () => {
    if ((window.history.state as HaddirHistoryState | null)?.__haddirApp) {
      window.history.back();
      return;
    }
    setIsGatekeeperPage(false);
    setActiveWorkspace(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("workspace");
    window.location.assign(url.pathname + url.search + url.hash);
  };

  const closeGatekeeper = () => {
    if ((window.history.state as HaddirHistoryState | null)?.workspace === "gatekeeper") {
      window.history.back();
      return;
    }
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
