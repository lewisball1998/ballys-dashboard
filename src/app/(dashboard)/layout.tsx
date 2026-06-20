import { ThemeProvider } from "@/components/theme/theme-provider";
import { AppShell } from "@/components/layout/app-shell";
import { SetupBanner } from "@/components/setup/setup-banner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppShell>
        <SetupBanner />
        {children}
      </AppShell>
    </ThemeProvider>
  );
}
