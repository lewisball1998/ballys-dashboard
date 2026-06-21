"use client";

import { useState } from "react";
import type { DashboardLayoutDTO } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DashboardGrid } from "./dashboard-grid";
import { DashboardEditor } from "./dashboard-editor";

/**
 * Client wrapper for the homepage. Seeded from the server-resolved layout (so the
 * view is SSR'd with no flash and hydrates without mismatch), it toggles between
 * the normal read-only grid and the customisation editor. Normal mode renders the
 * exact v0.2.2 grid plus a single "Customise dashboard" entry point.
 */
export function DashboardHome({ initialLayout }: { initialLayout: DashboardLayoutDTO }) {
  const [layout, setLayout] = useState<DashboardLayoutDTO>(initialLayout);
  const [editing, setEditing] = useState(false);

  const exitEdit = (saved?: DashboardLayoutDTO) => {
    if (saved) setLayout(saved);
    setEditing(false);
    // Return focus to the entry button for keyboard/AT users.
    requestAnimationFrame(() => document.getElementById("customise-dashboard-entry")?.focus());
  };

  if (editing) {
    return <DashboardEditor initial={layout} onClose={exitEdit} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          id="customise-dashboard-entry"
          variant="outline"
          size="sm"
          onClick={() => setEditing(true)}
        >
          Customise dashboard
        </Button>
      </div>
      <DashboardGrid layout={layout} />
    </div>
  );
}
