"use client";

import { useState } from "react";
import type { CategoryDTO } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createApp, updateApp } from "@/hooks/launcher-api";
import {
  apiFieldErrors,
  validateAppForm,
  type AppFieldErrors,
  type AppFormValues,
} from "./launcher-logic";

interface AppFormProps {
  editingId: number | null;
  initial: AppFormValues;
  categories: CategoryDTO[];
  onClose: () => void;
  onSaved: () => void;
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{messages.join(", ")}</p>;
}

export function AppForm({ editingId, initial, categories, onClose, onSaved }: AppFormProps) {
  const [values, setValues] = useState<AppFormValues>(initial);
  const [errors, setErrors] = useState<AppFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof AppFormValues>(key: K, value: AppFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const result = validateAppForm(values);
    if (!result.success) {
      setErrors(result.fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    const res = editingId == null ? await createApp(result.data) : await updateApp(editingId, result.data);
    setSaving(false);
    if (res.ok) {
      onSaved();
      onClose();
    } else {
      setErrors(apiFieldErrors(res.error.fields));
      setFormError(res.error.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <Card className="my-8 w-full max-w-lg bg-background">
        <CardHeader>
          <CardTitle>{editingId == null ? "Add app" : "Edit app"}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </CardHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-sm font-medium" htmlFor="app-name">
              Name
            </label>
            <Input id="app-name" value={values.name} onChange={(e) => set("name", e.target.value)} />
            <FieldError messages={errors.name} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="app-url">
              URL
            </label>
            <Input
              id="app-url"
              value={values.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://"
            />
            <FieldError messages={errors.url} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="app-desc">
              Description
            </label>
            <Input
              id="app-desc"
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
            />
            <FieldError messages={errors.description} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="app-cat">
              Category
            </label>
            <Select
              id="app-cat"
              value={values.categoryId == null ? "" : String(values.categoryId)}
              onChange={(e) => set("categoryId", e.target.value === "" ? null : Number(e.target.value))}
            >
              <option value="">Uncategorised</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="app-icon">
              Icon URL (or value)
            </label>
            <Input id="app-icon" value={values.icon} onChange={(e) => set("icon", e.target.value)} />
            <FieldError messages={errors.icon} />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="app-health-url">
              Health URL (optional — falls back to URL)
            </label>
            <Input
              id="app-health-url"
              value={values.healthUrl}
              onChange={(e) => set("healthUrl", e.target.value)}
              placeholder="https://"
            />
            <FieldError messages={errors.healthUrl} />
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.openNewTab}
                onChange={(e) => set("openNewTab", e.target.checked)}
              />
              Open in new tab
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.isFavourite}
                onChange={(e) => set("isFavourite", e.target.checked)}
              />
              Favourite
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.healthEnabled}
                onChange={(e) => set("healthEnabled", e.target.checked)}
              />
              Health checks
            </label>
          </div>

          {formError ? <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
