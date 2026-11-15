"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaRegistration() {
  const [updateReady, setUpdateReady] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosInstallHelp, setShowIosInstallHelp] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [installingApp, setInstallingApp] = useState(false);

  useEffect(() => {
    const isStandalone = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

    const wasInstallDismissed = () => {
      try {
        const until = Number(localStorage.getItem("haddir-install-dismissed-until") || 0);
        return until > Date.now();
      } catch {
        return false;
      }
    };

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (!isStandalone() && !wasInstallDismissed()) {
        setInstallPrompt(event as InstallPromptEvent);
      }
    };

    const onAppInstalled = () => {
      setInstallPrompt(null);
      setShowIosInstallHelp(false);
      try {
        localStorage.removeItem("haddir-install-dismissed-until");
      } catch {
        // Storage may be unavailable in private browsing.
      }
    };

    if (!isStandalone() && !wasInstallDismissed()) {
      const isAppleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent);
      if (isAppleMobile) setShowIosInstallHelp(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;
    let disposed = false;
    let hasReloaded = false;
    const pageWasAlreadyControlled = Boolean(navigator.serviceWorker.controller);

    const showWaitingWorker = () => {
      if (registration?.waiting && navigator.serviceWorker.controller) {
        setUpdateReady(true);
      }
    };

    const watchInstallingWorker = () => {
      const worker = registration?.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          setUpdateReady(true);
        }
      });
    };

    const register = async () => {
      try {
        const result = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        if (disposed) return;
        registration = result;
        showWaitingWorker();
        registration.addEventListener("updatefound", watchInstallingWorker);
        watchInstallingWorker();
        await registration.update();
        showWaitingWorker();
      } catch (error) {
        console.warn("تعذر تفعيل تحديثات تطبيق حاضر.", error);
      }
    };

    const checkForUpdate = () => {
      if (document.visibilityState === "visible" && registration) {
        void registration.update().then(showWaitingWorker).catch((error) => {
          console.warn("تعذر فحص تحديث تطبيق حاضر.", error);
        });
      }
    };

    const onControllerChange = () => {
      if (pageWasAlreadyControlled && !hasReloaded) {
        hasReloaded = true;
        window.location.reload();
      }
    };

    void register();
    window.addEventListener("focus", checkForUpdate);
    document.addEventListener("visibilitychange", checkForUpdate);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      disposed = true;
      window.removeEventListener("focus", checkForUpdate);
      document.removeEventListener("visibilitychange", checkForUpdate);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const dismissInstall = () => {
    setInstallPrompt(null);
    setShowIosInstallHelp(false);
    try {
      localStorage.setItem(
        "haddir-install-dismissed-until",
        String(Date.now() + 14 * 24 * 60 * 60 * 1000)
      );
    } catch {
      // The prompt remains dismissible for this page session.
    }
  };

  const installApp = async () => {
    if (!installPrompt) {
      setShowIosInstallHelp(true);
      return;
    }
    setInstallingApp(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === "dismissed") dismissInstall();
    } catch (error) {
      console.warn("تعذر بدء تثبيت حاضر.", error);
    } finally {
      setInstallingApp(false);
    }
  };

  const applyUpdate = async () => {
    setInstallingUpdate(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      if (!registration?.waiting) {
        setInstallingUpdate(false);
        setUpdateReady(false);
        await registration?.update();
        return;
      }
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    } catch (error) {
      console.warn("تعذر تطبيق تحديث حاضر.", error);
      setInstallingUpdate(false);
    }
  };

  return (
    <>
      {(installPrompt || showIosInstallHelp) && (
        <aside
          dir="rtl"
          role="region"
          aria-label="تثبيت تطبيق حاضر"
          style={{
            position: "fixed", zIndex: 9998, insetInline: 12,
            bottom: "calc(158px + env(safe-area-inset-bottom))",
            maxWidth: 520, marginInline: "auto", padding: 14,
            display: "flex", alignItems: "center", gap: 11,
            border: "1px solid rgba(91,46,255,.2)", borderRadius: 17,
            background: "var(--surface, #fff)", color: "var(--fg, #18343a)",
            boxShadow: "0 12px 36px rgba(12,48,57,.18)",
            fontFamily: "var(--font-sans, sans-serif)",
          }}
        >
          <span aria-hidden="true" style={{
            display: "grid", placeItems: "center", flex: "0 0 40px",
            width: 40, height: 40, borderRadius: 12,
            background: "rgba(91,46,255,.11)", color: "#5B2EFF", fontSize: 21,
          }}>↥</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: 13 }}>ثبّت حاضر على جهازك</strong>
            <span style={{ display: "block", marginTop: 4, fontSize: 11, opacity: .75, lineHeight: 1.7 }}>
              {showIosInstallHelp && !installPrompt
                ? "اضغط مشاركة في المتصفح ثم اختر «إضافة إلى الشاشة الرئيسية»."
                : "وصول أسرع لفعالياتك وتذاكرك، مباشرة من الشاشة الرئيسية."}
            </span>
          </div>
          {installPrompt ? (
            <button type="button" onClick={installApp} disabled={installingApp} style={{
              flex: "0 0 auto", border: 0, borderRadius: 10, padding: "10px 13px",
              background: "#5B2EFF", color: "#fff", font: "inherit",
              fontSize: 11, fontWeight: 800, opacity: installingApp ? .65 : 1,
            }}>{installingApp ? "لحظة..." : "تثبيت"}</button>
          ) : (
            <button type="button" onClick={() => setShowIosInstallHelp(false)} style={{
              flex: "0 0 auto", border: 0, borderRadius: 10, padding: "9px 11px",
              background: "rgba(91,46,255,.1)", color: "#5B2EFF", font: "inherit",
              fontSize: 11, fontWeight: 800,
            }}>حسناً</button>
          )}
          <button type="button" aria-label="إخفاء اقتراح التثبيت" onClick={dismissInstall} style={{
            flex: "0 0 auto", border: 0, padding: 4, background: "transparent",
            color: "inherit", opacity: .55, fontSize: 18,
          }}>×</button>
        </aside>
      )}

      {updateReady && (
        <aside
          dir="rtl"
          role="status"
          aria-live="polite"
          style={{
            position: "fixed", zIndex: 9999, insetInline: 12,
            bottom: "calc(86px + env(safe-area-inset-bottom))",
            maxWidth: 520, marginInline: "auto", padding: 15,
            display: "flex", alignItems: "center", gap: 12,
            border: "1px solid rgba(91,46,255,.22)", borderRadius: 17,
            background: "var(--surface, #fff)", color: "var(--fg, #18343a)",
            boxShadow: "0 12px 36px rgba(12,48,57,.2)",
            fontFamily: "var(--font-sans, sans-serif)",
          }}
        >
          <span aria-hidden="true" style={{
            display: "grid", placeItems: "center", flex: "0 0 38px",
            width: 38, height: 38, borderRadius: 12,
            background: "rgba(91,46,255,.11)", color: "#5B2EFF", fontSize: 20,
          }}>↻</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: 13 }}>تحديث جديد لحاضر جاهز</strong>
            <span style={{ display: "block", marginTop: 4, fontSize: 11, opacity: .75, lineHeight: 1.7 }}>
              حدّث التطبيق للحصول على آخر التحسينات والميزات.
            </span>
          </div>
          <button type="button" onClick={applyUpdate} disabled={installingUpdate} style={{
            flex: "0 0 auto", border: 0, borderRadius: 10, padding: "10px 13px",
            background: "#5B2EFF", color: "#fff", font: "inherit",
            fontSize: 11, fontWeight: 800, opacity: installingUpdate ? .65 : 1,
          }}>{installingUpdate ? "جارٍ التحديث..." : "حدّث الآن"}</button>
          <button type="button" aria-label="لاحقاً" onClick={() => setUpdateReady(false)} style={{
            flex: "0 0 auto", border: 0, padding: 4, background: "transparent",
            color: "inherit", opacity: .55, fontSize: 18,
          }}>×</button>
        </aside>
      )}
    </>
  );
}
