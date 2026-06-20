"use client";

import { useEffect, useState } from "react";
import { ACCENT_COLORS, THEME_MODES } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { useSettings } from "@/hooks/use-settings";
import { useTheme } from "@/components/theme/theme-provider";
import {
  apiErrorToFieldErrors,
  settingsToForm,
  validateForm,
  type FieldErrors,
  type SettingsFormValues,
} from "./settings-form-logic";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{messages.join(", ")}</p>;
}

export function SettingsForm() {
  const { settings, loading, error, reload, save } = useSettings();
  const { setThemeMode, setAccent, setDashboardName } = useTheme();

  const [values, setValues] = useState<SettingsFormValues | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings && values === null) setValues(settingsToForm(settings));
  }, [settings, values]);

  if (loading && !settings) return <LoadingState label="Loading settings…" />;
  if (error && !settings) return <ErrorState message={error} onRetry={reload} />;
  if (!values) return <LoadingState label="Preparing form…" />;

  const set = <K extends keyof SettingsFormValues>(key: K, value: SettingsFormValues[K]) => {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaved(false);
    const result = validateForm(values);
    if (!result.success) {
      setErrors(result.fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    const res = await save(result.data);
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setThemeMode(values.theme);
      setAccent(values.accent);
      setDashboardName(values.dashboardName);
    } else {
      setErrors(apiErrorToFieldErrors(res.error));
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor="dashboardName">
              Dashboard name
            </label>
            <Input
              id="dashboardName"
              value={values.dashboardName}
              onChange={(e) => set("dashboardName", e.target.value)}
            />
            <FieldError messages={errors.dashboardName} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="timezone">
              Timezone
            </label>
            <Input
              id="timezone"
              value={values.timezone}
              onChange={(e) => set("timezone", e.target.value)}
              placeholder="e.g. Europe/London"
            />
            <FieldError messages={errors.timezone} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="theme">
              Theme mode
            </label>
            <Select
              id="theme"
              value={values.theme}
              onChange={(e) => {
                const mode = e.target.value as SettingsFormValues["theme"];
                set("theme", mode);
                setThemeMode(mode);
              }}
            >
              {THEME_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </Select>
            <FieldError messages={errors.theme} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="accent">
              Accent colour
            </label>
            <Select
              id="accent"
              value={values.accent}
              onChange={(e) => {
                const accent = e.target.value as SettingsFormValues["accent"];
                set("accent", accent);
                setAccent(accent);
              }}
            >
              {ACCENT_COLORS.map((accent) => (
                <option key={accent} value={accent}>
                  {accent}
                </option>
              ))}
            </Select>
            <FieldError messages={errors.accent} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Polling & retention</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-sm font-medium" htmlFor="appHealthIntervalMs">
              App health interval (ms)
            </label>
            <Input
              id="appHealthIntervalMs"
              type="number"
              min={5000}
              value={values.appHealthIntervalMs}
              onChange={(e) => set("appHealthIntervalMs", Number(e.target.value))}
            />
            <FieldError messages={errors.appHealthIntervalMs} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="systemMetricIntervalMs">
              System metric interval (ms)
            </label>
            <Input
              id="systemMetricIntervalMs"
              type="number"
              min={5000}
              value={values.systemMetricIntervalMs}
              onChange={(e) => set("systemMetricIntervalMs", Number(e.target.value))}
            />
            <FieldError messages={errors.systemMetricIntervalMs} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="metricRetentionDays">
              Metric retention (days)
            </label>
            <Input
              id="metricRetentionDays"
              type="number"
              min={1}
              max={365}
              value={values.metricRetentionDays}
              onChange={(e) => set("metricRetentionDays", Number(e.target.value))}
            />
            <FieldError messages={errors.metricRetentionDays} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alert thresholds (%)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-sm font-medium" htmlFor="thresholdCpu">
              CPU
            </label>
            <Input
              id="thresholdCpu"
              type="number"
              min={1}
              max={100}
              value={values.thresholdCpu}
              onChange={(e) => set("thresholdCpu", Number(e.target.value))}
            />
            <FieldError messages={errors.thresholdCpu} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="thresholdMemory">
              Memory
            </label>
            <Input
              id="thresholdMemory"
              type="number"
              min={1}
              max={100}
              value={values.thresholdMemory}
              onChange={(e) => set("thresholdMemory", Number(e.target.value))}
            />
            <FieldError messages={errors.thresholdMemory} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="thresholdStorage">
              Storage
            </label>
            <Input
              id="thresholdStorage"
              type="number"
              min={1}
              max={100}
              value={values.thresholdStorage}
              onChange={(e) => set("thresholdStorage", Number(e.target.value))}
            />
            <FieldError messages={errors.thresholdStorage} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
        {saved ? <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved</span> : null}
        <FieldError messages={errors.form} />
      </div>
    </form>
  );
}
