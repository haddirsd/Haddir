"use client";

import { useEffect, useState } from "react";

export function PwaRegistration() {
  const [updateReady, setUpdateReady] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;
    let disposed = false;
    let reloadAfterUpdate = false;

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
      if (document.visibilityState === "visible") {
        void registration?.update().then(showWaitingWorker).catch((error) => {
          console.warn("تعذر فحص تحديث تطبيق حاضر.", error);
        });
      }
    };

    const onControllerChange = () => {
      if (reloadAfterUpdate) window.location.reload();
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

  const applyUpdate = () => {
    setInstallingUpdate(true);
    navigator.serviceWorker.getRegistration("/").then((registration) => {
      if (!registration?.waiting) {
        setInstallingUpdate(false);
        setUpdateReady(false);
        return;
      }
      const onControllerChange = () => window.location.reload();
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange, { once: true });
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }).catch(() => {
      setInstallingUpdate(false);
    });
  };

  if (!updateReady) return null;

  return (
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
  );
}
