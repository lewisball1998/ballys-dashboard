"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { AccentColor, AppSettingsDTO, ThemeMode } from "@/lib/types";
import { apiRequest } from "@/hooks/api-client";

interface ThemeContextValue {
  themeMode: ThemeMode;
  accent: AccentColor;
  dashboardName: string;
  setThemeMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  setDashboardName: (name: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_KEY = "bd-theme";
const ACCENT_KEY = "bd-accent";

function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  const isDark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
  root.classList.toggle("light", !isDark);
}

function applyAccent(accent: AccentColor): void {
  document.documentElement.dataset.accent = accent;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [accent, setAccentState] = useState<AccentColor>("blue");
  const [dashboardName, setDashboardNameState] = useState<string>("Bally's Dashboard");

  // Apply cached values immediately, then reconcile with server settings.
  useEffect(() => {
    const cachedTheme = (localStorage.getItem(THEME_KEY) as ThemeMode | null) ?? "system";
    const cachedAccent = (localStorage.getItem(ACCENT_KEY) as AccentColor | null) ?? "blue";
    setThemeModeState(cachedTheme);
    applyTheme(cachedTheme);
    setAccentState(cachedAccent);
    applyAccent(cachedAccent);

    void apiRequest<AppSettingsDTO>("/api/settings").then((res) => {
      if (!res.ok) return;
      setThemeModeState(res.data.theme);
      applyTheme(res.data.theme);
      localStorage.setItem(THEME_KEY, res.data.theme);
      setAccentState(res.data.accent);
      applyAccent(res.data.accent);
      localStorage.setItem(ACCENT_KEY, res.data.accent);
      setDashboardNameState(res.data.dashboardName);
    });
  }, []);

  // Track OS theme changes while in "system" mode.
  useEffect(() => {
    if (themeMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themeMode]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    applyTheme(mode);
    localStorage.setItem(THEME_KEY, mode);
  }, []);

  const setAccent = useCallback((next: AccentColor) => {
    setAccentState(next);
    applyAccent(next);
    localStorage.setItem(ACCENT_KEY, next);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        accent,
        dashboardName,
        setThemeMode,
        setAccent,
        setDashboardName: setDashboardNameState,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
