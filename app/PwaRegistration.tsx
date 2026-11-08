"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;
    let disposed = false;

    const register = async () => {
      try {
        const result = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        if (disposed) return;
        registration = result;
        await registration.update();
      } catch (error) {
        console.warn("تعذر تفعيل تحديثات تطبيق حاضر.", error);
      }
    };

    const checkForUpdate = () => {
      if (document.visibilityState === "visible") {
        void registration?.update().catch((error) => {
          console.warn("تعذر فحص تحديث تطبيق حاضر.", error);
        });
      }
    };

    void register();
    window.addEventListener("focus", checkForUpdate);
    document.addEventListener("visibilitychange", checkForUpdate);

    return () => {
      disposed = true;
      window.removeEventListener("focus", checkForUpdate);
      document.removeEventListener("visibilitychange", checkForUpdate);
    };
  }, []);

  return null;
}
