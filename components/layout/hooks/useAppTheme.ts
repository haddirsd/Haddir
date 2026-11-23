"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import {
  DARK_THEME_COLOR,
  LIGHT_THEME_COLOR,
  THEME_STORAGE_KEY,
} from "../../../lib/constants";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function applyTheme(darkMode: boolean) {
  const theme = darkMode ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Theme application must still work when storage is unavailable.
  }

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  themeMeta?.setAttribute(
    "content",
    darkMode ? DARK_THEME_COLOR : LIGHT_THEME_COLOR,
  );
}

export function useAppTheme() {
  const [darkMode, setDarkMode] = useState(false);
  const [themeReady, setThemeReady] = useState(false);

  useIsomorphicLayoutEffect(() => {
    let initialDarkMode = false;

    try {
      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      initialDarkMode = savedTheme
        ? savedTheme === "dark"
        : !!prefersDark;
    } catch {
      initialDarkMode = false;
    }

    applyTheme(initialDarkMode);
    setDarkMode(initialDarkMode);
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    applyTheme(darkMode);
  }, [darkMode, themeReady]);

  return { darkMode, setDarkMode };
}
