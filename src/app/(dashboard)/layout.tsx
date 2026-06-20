import { ThemeProvider } from "@/components/theme/theme-provider";
import { AppShell } from "@/components/layout/app-shell";
import { SetupBanner } from "@/components/setup/setup-banner";
import { AuthGate } from "@/components/auth/auth-gate";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthGate>
        <AppShell>
          <SetupBanner />
          {children}
        </AppShell>
      </AuthGate>
    </ThemeProvider>
  );
}
