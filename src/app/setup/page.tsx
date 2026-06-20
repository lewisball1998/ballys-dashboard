import { ThemeProvider } from "@/components/theme/theme-provider";
import { SetupWizard } from "@/components/setup/setup-wizard";

export default function SetupPage() {
  return (
    <ThemeProvider>
      <main className="min-h-screen px-6 py-12">
        <SetupWizard />
      </main>
    </ThemeProvider>
  );
}
