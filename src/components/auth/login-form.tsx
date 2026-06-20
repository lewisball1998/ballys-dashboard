"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { login } from "@/hooks/auth-api";
import { useAuthStatus } from "@/hooks/use-auth-status";
import {
  apiLoginErrors,
  buildLoginPayload,
  loginView,
  validateLogin,
  type LoginErrors,
  type LoginFormValues,
} from "./auth-logic";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{messages.join(", ")}</p>;
}

export function LoginForm() {
  const router = useRouter();
  const { status } = useAuthStatus();
  const [values, setValues] = useState<LoginFormValues>({ username: "", password: "" });
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const view = loginView(status);

  useEffect(() => {
    if (view === "authenticated") router.replace("/");
  }, [view, router]);

  if (view === "loading" || view === "authenticated") {
    return <LoadingState label={view === "loading" ? "Loading…" : "Redirecting…"} />;
  }

  if (view === "disabled") {
    return (
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>Authentication disabled</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-foreground/70">This dashboard does not require sign-in.</p>
          <Link href="/" className="text-sm font-medium text-accent hover:underline">
            Open dashboard
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (view === "needs-admin") {
    return (
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>Setup required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-foreground/70">No admin account exists yet. Finish setup to create one.</p>
          <Link href="/setup" className="text-sm font-medium text-accent hover:underline">
            Go to setup
          </Link>
        </CardContent>
      </Card>
    );
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const result = validateLogin(values);
    if (!result.success) {
      setErrors(result.fieldErrors);
      return;
    }
    setErrors({});
    setBusy(true);
    const res = await login(buildLoginPayload(values));
    setBusy(false);
    if (res.ok) {
      router.push("/");
    } else {
      setErrors(apiLoginErrors(res.error));
      setFormError(res.error.message);
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-sm font-medium" htmlFor="l-user">
              Username
            </label>
            <Input
              id="l-user"
              autoComplete="username"
              value={values.username}
              onChange={(e) => setValues((p) => ({ ...p, username: e.target.value }))}
            />
            <FieldError messages={errors.username} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="l-pass">
              Password
            </label>
            <Input
              id="l-pass"
              type="password"
              autoComplete="current-password"
              value={values.password}
              onChange={(e) => setValues((p) => ({ ...p, password: e.target.value }))}
            />
            <FieldError messages={errors.password} />
          </div>
          {formError ? <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p> : null}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
