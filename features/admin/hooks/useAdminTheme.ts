"use client";

import { useEffect, useState } from "react";

export function useAdminTheme() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const syncTheme = () => {
      const saved = window.localStorage.getItem("haddir-theme");
      const dark = saved ? saved === "dark" : !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      setDarkMode(dark);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };

    syncTheme();
    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, []);

  return darkMode;
}
