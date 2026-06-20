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
import { useTheme } from "@/components/theme/theme-provider";
import { completeSetup, fetchSetupStatus, seedTemplate } from "@/hooks/setup-api";
import {
  apiErrorToAppearanceErrors,
  buildCompletePayload,
  formatSeedResult,
  statusToAppearance,
  validateAppearance,
  type AppearanceErrors,
  type AppearanceValues,
} from "./setup-logic";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{messages.join(", ")}</p>;
}

export function SetupWizard() {
  const router = useRouter();
  const { setThemeMode, setAccent, setDashboardName } = useTheme();

  const [status, setStatus] = useState<SetupStatusDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [values, setValues] = useState<AppearanceValues | null>(null);
  const [errors, setErrors] = useState<AppearanceErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [template, setTemplate] = useState<string>("homelab");
  const [seedResult, setSeedResult] = useState<SetupSeedResultDTO | null>(null);

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

  const finish = async () => {
    const result = validateAppearance(values);
    if (!result.success) {
      setErrors(result.fieldErrors);
      setStep(1);
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await completeSetup(buildCompletePayload(values));
    setBusy(false);
    if (res.ok) {
      router.push("/");
    } else {
      setErrors(apiErrorToAppearanceErrors(res.error));
      setFormError(res.error.message);
    }
  };

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Set up Bally&apos;s Dashboard</CardTitle>
        <span className="text-xs text-foreground/50">Step {step} of 3</span>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 1 ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground/60">Choose how your dashboard looks.</p>
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
            <p className="text-sm text-foreground/60">
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
                    <span className="block text-xs text-foreground/60">{t.description}</span>
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
            <p className="text-xs text-foreground/50">You can add apps from the Apps page after setup.</p>
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
            <p className="text-sm text-foreground/60">Review and finish.</p>
            <ul className="space-y-1 text-sm">
              <li>
                <span className="text-foreground/60">Name:</span> {values.dashboardName}
              </li>
              <li>
                <span className="text-foreground/60">Theme:</span> {values.theme} · {values.accent}
              </li>
              <li>
                <span className="text-foreground/60">Timezone:</span> {values.timezone}
              </li>
            </ul>
            {formError ? <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p> : null}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
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
