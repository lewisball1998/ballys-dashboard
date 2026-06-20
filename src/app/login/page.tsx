import { ThemeProvider } from "@/components/theme/theme-provider";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <ThemeProvider>
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <LoginForm />
      </main>
    </ThemeProvider>
  );
}
