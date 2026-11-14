"use client";

import { useEffect, useState } from "react";
import {
  DARK_THEME_COLOR,
  LIGHT_THEME_COLOR,
  THEME_STORAGE_KEY,
} from "../../../lib/constants";

export function useAppTheme() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setDarkMode(savedTheme ? savedTheme === "dark" : !!prefersDark);
  }, []);

  useEffect(() => {
    const theme = darkMode ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    themeMeta?.setAttribute(
      "content",
      darkMode ? DARK_THEME_COLOR : LIGHT_THEME_COLOR,
    );
  }, [darkMode]);

  return { darkMode, setDarkMode };
}
