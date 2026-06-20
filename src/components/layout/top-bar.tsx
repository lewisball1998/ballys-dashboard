"use client";

import type { ThemeMode } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme/theme-provider";

const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  light: "dark",
  dark: "system",
  system: "light",
};

const MODE_LABEL: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function TopBar() {
  const { themeMode, setThemeMode, dashboardName } = useTheme();

  return (
    <header className="flex h-14 items-center justify-between border-b border-foreground/10 px-6">
      <span className="text-sm font-medium text-foreground/70">{dashboardName}</span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setThemeMode(NEXT_MODE[themeMode])}
        title="Toggle theme mode"
      >
        Theme: {MODE_LABEL[themeMode]}
      </Button>
    </header>
  );
}
