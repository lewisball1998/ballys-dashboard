"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CustomiseToolbarProps {
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
}

export function CustomiseToolbar({
  dirty,
  saving,
  saved,
  error,
  onSave,
  onCancel,
  onReset,
}: CustomiseToolbarProps) {
  return (
    <div className="border-border bg-surface/95 sticky top-14 z-20 -mx-1 rounded-xl border px-3 py-3 shadow-sm shadow-black/5 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-foreground text-sm font-semibold">Customising dashboard</span>
          {dirty ? (
            <Badge tone="warning">Unsaved changes</Badge>
          ) : (
            <Badge tone="neutral" dot={false}>
              No changes
            </Badge>
          )}
          <span role="status" aria-live="polite" className="text-muted text-xs">
            {saving ? "Saving…" : error ? null : saved ? "Saved" : null}
          </span>
          {error ? (
            <span role="alert" className="text-xs text-rose-600 dark:text-rose-400">
              {error}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onReset} disabled={saving}>
            Reset to default
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
