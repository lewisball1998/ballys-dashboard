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
    <header className="flex h-14 items-center justify-between border-b border-foreground/10 px-6">
      <span className="text-sm font-medium text-foreground/70">{dashboardName}</span>
      <div className="flex items-center gap-2">
        <NotificationBell />
        {showAuth ? (
          <>
            <span className="text-sm text-foreground/60">{status?.username}</span>
            <Button variant="outline" size="sm" onClick={onLogout}>
              Log out
            </Button>
          </>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setThemeMode(NEXT_MODE[themeMode])}
          title="Toggle theme mode"
        >
          Theme: {MODE_LABEL[themeMode]}
        </Button>
      </div>
    </header>
  );
}
