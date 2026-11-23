"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import {
  DARK_THEME_COLOR,
  LIGHT_THEME_COLOR,
  THEME_STORAGE_KEY,
} from "../../../lib/constants";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useAdminTheme() {
  const [darkMode, setDarkMode] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const syncTheme = () => {
      let savedTheme: string | null = null;
      try {
        savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      } catch {
        savedTheme = null;
      }

      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      const dark = savedTheme
        ? savedTheme === "dark"
        : !!prefersDark;

      setDarkMode(dark);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.documentElement.style.colorScheme = dark ? "dark" : "light";

      const themeMeta = document.querySelector('meta[name="theme-color"]');
      themeMeta?.setAttribute(
        "content",
        dark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR,
      );
    };

    syncTheme();
    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, []);

  return darkMode;
}
