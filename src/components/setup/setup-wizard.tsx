"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ACCENT_COLORS, THEME_MODES, type SetupSeedResultDTO, type SetupStatusDTO } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { DockerImport } from "@/components/docker/import/docker-import";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/theme-provider";
import { completeSetup, fetchSetupStatus, seedTemplate } from "@/hooks/setup-api";
import {
  apiErrorToAppearanceErrors,
  buildCompletePayload,
  EMPTY_SETUP_AUTH,
  formatSeedResult,
  statusToAppearance,
  validateAppearance,
  validateSetupAuth,
  type AppearanceErrors,
  type AppearanceValues,
  type SetupAuthErrors,
  type SetupAuthValues,
} from "./setup-logic";

type Step = 1 | 2 | 3 | 4;

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{messages.join(", ")}</p>;
}

export function SetupWizard() {
  const router = useRouter();
  const { setThemeMode, setAccent, setDashboardName } = useTheme();

  const [status, setStatus] = useState<SetupStatusDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>(1);
  const [values, setValues] = useState<AppearanceValues | null>(null);
  const [errors, setErrors] = useState<AppearanceErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [template, setTemplate] = useState<string>("homelab");
  const [seedResult, setSeedResult] = useState<SetupSeedResultDTO | null>(null);
  const [showDockerImport, setShowDockerImport] = useState(false);

  const [auth, setAuth] = useState<SetupAuthValues>(EMPTY_SETUP_AUTH);
  const [authErrors, setAuthErrors] = useState<SetupAuthErrors>({});

  const load = useCallback(async () => {
    setError(null);
    const res = await fetchSetupStatus();
    if (res.ok) {
      setStatus(res.data);
      setValues(statusToAppearance(res.data));
      if (res.data.templates[0]) setTemplate(res.data.templates[0].id);
    } else {
      setError(res.error.message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && status === null) return <ErrorState message={error} onRetry={load} />;
  if (status === null || values === null) return <LoadingState label="Loading setup…" />;

  if (status.setupCompleted) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardHeader>
          <CardTitle>Setup complete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground/70">Your dashboard is ready to use.</p>
          <Link
            href="/"
            className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            Open dashboard
          </Link>
        </CardContent>
      </Card>
    );
  }

  const set = <K extends keyof AppearanceValues>(key: K, value: AppearanceValues[K]) =>
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
  const setAuthField = <K extends keyof SetupAuthValues>(key: K, value: SetupAuthValues[K]) =>
    setAuth((prev) => ({ ...prev, [key]: value }));

  const goToTemplates = () => {
    const result = validateAppearance(values);
    if (!result.success) {
      setErrors(result.fieldErrors);
      return;
    }
    setErrors({});
    setStep(2);
  };

  const runSeed = async () => {
    setBusy(true);
    setFormError(null);
    const res = await seedTemplate(template as "blank" | "homelab");
    setBusy(false);
    if (res.ok) setSeedResult(res.data);
    else setFormError(res.error.message);
  };

  const goToFinish = () => {
    const result = validateSetupAuth(auth);
    if (!result.success) {
      setAuthErrors(result.fieldErrors);
      return;
    }
    setAuthErrors({});
    setStep(4);
  };

  const finish = async () => {
    const appearance = validateAppearance(values);
    if (!appearance.success) {
      setErrors(appearance.fieldErrors);
      setStep(1);
      return;
    }
    const authResult = validateSetupAuth(auth);
    if (!authResult.success) {
      setAuthErrors(authResult.fieldErrors);
      setStep(3);
      return;
    }

    setBusy(true);
    setFormError(null);
    const res = await completeSetup(buildCompletePayload(values, authResult.auth));
    setBusy(false);
    if (res.ok) {
      // If an admin was created, auth is now active — go to login. Otherwise dashboard.
      router.push("skip" in authResult.auth ? "/" : "/login");
    } else {
      setErrors(apiErrorToAppearanceErrors(res.error));
      setFormError(res.error.message);
    }
  };

  return (
    <Card className={cn("mx-auto", step === 2 && showDockerImport ? "max-w-3xl" : "max-w-lg")}>
      <CardHeader>
        <CardTitle>Set up Bally&apos;s Dashboard</CardTitle>
        <span className="text-xs text-muted">Step {step} of 4</span>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 1 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">Choose how your dashboard looks.</p>
            <div>
              <label className="text-sm font-medium" htmlFor="s-name">
                Dashboard name
              </label>
              <Input
                id="s-name"
                value={values.dashboardName}
                onChange={(e) => {
                  set("dashboardName", e.target.value);
                  setDashboardName(e.target.value);
                }}
              />
              <FieldError messages={errors.dashboardName} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium" htmlFor="s-theme">
                  Theme
                </label>
                <Select
                  id="s-theme"
                  value={values.theme}
                  onChange={(e) => {
                    const v = e.target.value as AppearanceValues["theme"];
                    set("theme", v);
                    setThemeMode(v);
                  }}
                >
                  {THEME_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="s-accent">
                  Accent
                </label>
                <Select
                  id="s-accent"
                  value={values.accent}
                  onChange={(e) => {
                    const v = e.target.value as AppearanceValues["accent"];
                    set("accent", v);
                    setAccent(v);
                  }}
                >
                  {ACCENT_COLORS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="s-tz">
                Timezone
              </label>
              <Input
                id="s-tz"
                value={values.timezone}
                onChange={(e) => set("timezone", e.target.value)}
                placeholder="e.g. Europe/London"
              />
              <FieldError messages={errors.timezone} />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="s-logo">
                Logo URL (optional)
              </label>
              <Input id="s-logo" value={values.logoPath} onChange={(e) => set("logoPath", e.target.value)} />
              <FieldError messages={errors.logoPath} />
            </div>
            <div className="flex justify-end">
              <Button onClick={goToTemplates}>Next</Button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Pick a starter template to create categories, or skip and add your own later.
            </p>
            <div className="space-y-2">
              {status.templates.map((t) => (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-start gap-2 rounded-md border border-foreground/15 p-3"
                >
                  <input
                    type="radio"
                    name="template"
                    className="mt-1"
                    checked={template === t.id}
                    onChange={() => setTemplate(t.id)}
                  />
                  <span>
                    <span className="text-sm font-medium">{t.name}</span>
                    <span className="block text-xs text-muted">{t.description}</span>
                    {t.categories.length > 0 ? (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {t.categories.map((c) => (
                          <Badge key={c} tone="neutral">
                            {c}
                          </Badge>
                        ))}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
            {seedResult ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">{formatSeedResult(seedResult)}</p>
            ) : null}
            {formError ? <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p> : null}

            {/* Optional: discover & import apps from Docker. Reuses the same
                import flow as the Apps page; nothing is imported automatically. */}
            <div className="space-y-2 rounded-md border border-foreground/15 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Import from Docker (optional)</p>
                  <p className="text-xs text-muted">
                    Detect your running containers and turn the ones you choose into apps. Needs
                    Docker access enabled (see <code>docs/DOCKER.md</code>).
                  </p>
                </div>
                <Button variant="outline" onClick={() => setShowDockerImport((v) => !v)}>
                  {showDockerImport ? "Hide" : "Import from Docker"}
                </Button>
              </div>
              {showDockerImport ? (
                <div className="border-t border-foreground/10 pt-3">
                  <DockerImport embedded />
                </div>
              ) : null}
            </div>

            <p className="text-xs text-muted">
              You can also add apps manually, or do all of this later from the Apps page — none of
              this is required to finish setup.
            </p>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" disabled={busy} onClick={runSeed}>
                  {busy ? "Applying…" : "Apply template"}
                </Button>
                <Button onClick={() => setStep(3)}>Next</Button>
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">Secure your dashboard.</p>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-foreground/15 p-3">
                <input
                  type="radio"
                  name="authmode"
                  className="mt-1"
                  checked={auth.mode === "create"}
                  onChange={() => setAuthField("mode", "create")}
                />
                <span>
                  <span className="text-sm font-medium">Create an admin login</span>
                  <span className="block text-xs text-muted">
                    Require a username and password to access the dashboard.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-foreground/15 p-3">
                <input
                  type="radio"
                  name="authmode"
                  className="mt-1"
                  checked={auth.mode === "skip"}
                  onChange={() => setAuthField("mode", "skip")}
                />
                <span>
                  <span className="text-sm font-medium">Skip authentication</span>
                  <span className="block text-xs text-amber-600 dark:text-amber-400">
                    Only recommended behind Tailscale, a VPN, or a trusted reverse proxy.
                  </span>
                </span>
              </label>
            </div>

            {auth.mode === "create" ? (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium" htmlFor="a-user">
                    Admin username
                  </label>
                  <Input id="a-user" value={auth.username} onChange={(e) => setAuthField("username", e.target.value)} />
                  <FieldError messages={authErrors.username} />
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor="a-pass">
                    Password (min 8 characters)
                  </label>
                  <Input
                    id="a-pass"
                    type="password"
                    value={auth.password}
                    onChange={(e) => setAuthField("password", e.target.value)}
                  />
                  <FieldError messages={authErrors.password} />
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor="a-confirm">
                    Confirm password
                  </label>
                  <Input
                    id="a-confirm"
                    type="password"
                    value={auth.confirm}
                    onChange={(e) => setAuthField("confirm", e.target.value)}
                  />
                  <FieldError messages={authErrors.confirm} />
                </div>
              </div>
            ) : null}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={goToFinish}>Next</Button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">Review and finish.</p>
            <ul className="space-y-1 text-sm">
              <li>
                <span className="text-muted">Name:</span> {values.dashboardName}
              </li>
              <li>
                <span className="text-muted">Theme:</span> {values.theme} · {values.accent}
              </li>
              <li>
                <span className="text-muted">Timezone:</span> {values.timezone}
              </li>
              <li>
                <span className="text-muted">Auth:</span>{" "}
                {auth.mode === "create" ? `enabled (admin: ${auth.username})` : "disabled (skipped)"}
              </li>
            </ul>
            {formError ? <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p> : null}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button disabled={busy} onClick={finish}>
                {busy ? "Finishing…" : "Finish setup"}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
