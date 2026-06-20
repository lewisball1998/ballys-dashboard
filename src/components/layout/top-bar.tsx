"use client";

import { useRouter } from "next/navigation";
import type { ThemeMode } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme/theme-provider";
import { useAuthStatus } from "@/hooks/use-auth-status";
import { logout } from "@/hooks/auth-api";
import { NotificationBell } from "./notification-bell";

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
  const router = useRouter();
  const { themeMode, setThemeMode, dashboardName } = useTheme();
  const { status } = useAuthStatus();

  const showAuth = Boolean(status?.authEnabled && status?.authenticated);

  const onLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
        <span className="truncate text-sm font-medium text-foreground/80">{dashboardName}</span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <NotificationBell />
        {showAuth ? (
          <>
            <span className="hidden text-sm text-muted sm:inline">{status?.username}</span>
            <Button variant="ghost" size="sm" onClick={onLogout}>
              Log out
            </Button>
          </>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setThemeMode(NEXT_MODE[themeMode])}
          title="Toggle theme mode"
        >
          {MODE_LABEL[themeMode]}
        </Button>
      </div>
    </header>
  );
}
