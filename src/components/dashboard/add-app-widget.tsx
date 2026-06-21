"use client";

import { useEffect, useState } from "react";
import type { AppDTO } from "@/lib/types";
import { fetchApps } from "@/hooks/launcher-api";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

interface SectionOption {
  id: string;
  label: string;
}

/**
 * "Add an app widget" area for the dashboard editor (v0.2.4). Lists existing
 * active apps (hidden included, retired excluded), lets the user pick one and a
 * target section, and calls `onAdd`. Already-placed apps are disabled and marked
 * "(added)" — one widget per app. Adding only mutates the draft; nothing persists
 * until the editor's Save. Intentionally plain (not marketplace-like).
 */
export function AddAppWidget({
  sections,
  placedAppIds,
  defaultSectionId,
  onAdd,
}: {
  sections: SectionOption[];
  placedAppIds: number[];
  defaultSectionId: string;
  onAdd: (app: AppDTO, sectionId: string) => void;
}) {
  const [apps, setApps] = useState<AppDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appId, setAppId] = useState("");
  const [sectionId, setSectionId] = useState(defaultSectionId);

  useEffect(() => {
    let active = true;
    // Active apps only (retired excluded); hidden included so a pinned-but-hidden
    // app can still be added as its own widget.
    void fetchApps({ lifecycle: "active", includeHidden: true }).then((res) => {
      if (!active) return;
      if (res.ok) setApps(res.data.items);
      else setError(res.error.message);
    });
    return () => {
      active = false;
    };
  }, []);

  // Keep the section selection valid if sections are added/removed/renamed.
  useEffect(() => {
    if (!sections.some((s) => s.id === sectionId)) setSectionId(defaultSectionId);
  }, [sections, sectionId, defaultSectionId]);

  const placed = new Set(placedAppIds);
  const selectedApp = apps?.find((a) => String(a.id) === appId) ?? null;
  const canAdd =
    selectedApp !== null && !placed.has(selectedApp.id) && sections.some((s) => s.id === sectionId);

  const handleAdd = () => {
    if (!selectedApp || !canAdd) return;
    onAdd(selectedApp, sectionId);
    setAppId("");
  };

  const noApps = apps !== null && apps.length === 0;

  return (
    <div className="border-border bg-surface-2/20 rounded-xl border border-dashed p-4">
      <p className="text-muted mb-1 text-xs font-medium">Add an app widget</p>

      {error ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
      ) : noApps ? (
        <p className="text-muted text-sm">
          No apps available yet. Add an app first to pin it here.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <label
              htmlFor="add-app-widget-app"
              className="text-muted mb-1 block text-xs font-medium"
            >
              App
            </label>
            <Select
              id="add-app-widget-app"
              value={appId}
              disabled={apps === null}
              onChange={(e) => setAppId(e.target.value)}
              className="h-9"
            >
              <option value="">{apps === null ? "Loading apps…" : "Choose an app…"}</option>
              {(apps ?? []).map((app) => {
                const added = placed.has(app.id);
                return (
                  <option key={app.id} value={app.id} disabled={added}>
                    {app.name}
                    {added ? " (added)" : ""}
                  </option>
                );
              })}
            </Select>
          </div>

          {sections.length > 1 ? (
            <div className="min-w-[10rem] flex-1">
              <label
                htmlFor="add-app-widget-section"
                className="text-muted mb-1 block text-xs font-medium"
              >
                Section
              </label>
              <Select
                id="add-app-widget-section"
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="h-9"
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <Button
            variant="outline"
            size="sm"
            className="h-9"
            disabled={!canAdd}
            onClick={handleAdd}
          >
            Add widget
          </Button>
        </div>
      )}
    </div>
  );
}
