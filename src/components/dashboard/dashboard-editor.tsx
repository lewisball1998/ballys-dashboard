"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DashboardLayoutDTO, ResolvedSection, WidgetSizeToken } from "@/lib/types";
import { DEFAULT_SECTION_ID } from "@/lib/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { resetLayout, saveLayout } from "@/hooks/dashboard-api";
import { CustomiseToolbar } from "./customise-toolbar";
import { SectionEditor } from "./section-editor";
import {
  addSection,
  canDeleteSection,
  deleteSection,
  dtoToConfig,
  isDirty,
  moveSection,
  moveWidget,
  moveWidgetToSection,
  renameSection,
  setWidgetSize,
  toggleWidgetHidden,
} from "./dashboard-editor-logic";

type ConfirmState =
  | { kind: "reset" }
  | { kind: "discard" }
  | { kind: "deleteSection"; sectionId: string }
  | null;

function sectionLabel(section: { id: string; title: string }): string {
  if (section.title.trim() !== "") return section.title;
  return section.id === DEFAULT_SECTION_ID ? "Default section" : "Untitled section";
}

export function DashboardEditor({
  initial,
  onClose,
}: {
  initial: DashboardLayoutDTO;
  /** Called to leave edit mode. Pass a layout to update the view, omit to keep current. */
  onClose: (saved?: DashboardLayoutDTO) => void;
}) {
  const [baseline, setBaseline] = useState<DashboardLayoutDTO>(initial);
  const [draft, setDraft] = useState<DashboardLayoutDTO>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const dirty = useMemo(() => isDirty(draft, baseline), [draft, baseline]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const apply = (fn: (d: DashboardLayoutDTO) => DashboardLayoutDTO, message?: string) => {
    setDraft((d) => fn(d));
    setSaved(false);
    if (message) setAnnouncement(message);
  };

  const sectionOptions = draft.sections.map((s) => ({ id: s.id, label: sectionLabel(s) }));

  const onSave = async () => {
    setSaving(true);
    setError(null);
    const res = await saveLayout(dtoToConfig(draft));
    setSaving(false);
    if (res.ok) {
      onClose(res.data);
    } else {
      setError(res.error.message);
      setAnnouncement("Save failed");
    }
  };

  const onCancel = () => {
    if (dirty) setConfirm({ kind: "discard" });
    else onClose();
  };

  const doReset = async () => {
    setConfirm(null);
    setSaving(true);
    setError(null);
    const res = await resetLayout();
    setSaving(false);
    if (res.ok) {
      setBaseline(res.data);
      setDraft(res.data);
      setSaved(true);
      setAnnouncement("Reset to default layout");
    } else {
      setError(res.error.message);
    }
  };

  const onAddSection = () => {
    const title = newSectionTitle.trim();
    if (title === "") return;
    apply((d) => addSection(d, title), `Added section ${title}`);
    setNewSectionTitle("");
  };

  const confirmProps =
    confirm?.kind === "reset"
      ? {
          title: "Reset to default layout?",
          description: "This removes your customisations and restores the default dashboard.",
          confirmLabel: "Reset",
          onConfirm: doReset,
        }
      : confirm?.kind === "discard"
        ? {
            title: "Discard unsaved changes?",
            description: "Your changes to the dashboard layout will be lost.",
            confirmLabel: "Discard",
            onConfirm: () => {
              setConfirm(null);
              onClose();
            },
          }
        : confirm?.kind === "deleteSection"
          ? {
              title: "Delete this section?",
              description: "The empty section will be removed from your dashboard.",
              confirmLabel: "Delete",
              onConfirm: () => {
                apply((d) => deleteSection(d, confirm.sectionId), "Section deleted");
                setConfirm(null);
              },
            }
          : null;

  return (
    <div className="space-y-5">
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <CustomiseToolbar
        dirty={dirty}
        saving={saving}
        saved={saved}
        error={error}
        onSave={onSave}
        onCancel={onCancel}
        onReset={() => setConfirm({ kind: "reset" })}
      />

      <div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-foreground text-sm font-semibold outline-none"
        >
          Edit your dashboard
        </h2>
        <p className="text-muted mt-1 text-sm">
          Show or hide widgets, change their size, reorder them, and group them into sections.
          Nothing is saved until you choose{" "}
          <span className="text-foreground font-medium">Save changes</span>.
        </p>
      </div>

      <div className="space-y-4">
        {draft.sections.map((section: ResolvedSection, index) => (
          <SectionEditor
            key={section.id}
            section={section}
            index={index}
            total={draft.sections.length}
            isDefaultSection={section.id === DEFAULT_SECTION_ID}
            canDelete={canDeleteSection(draft, section.id)}
            sectionOptions={sectionOptions}
            onRename={(title) =>
              apply((d) => renameSection(d, section.id, title), "Section renamed")
            }
            onMoveSection={(dir) =>
              apply((d) => moveSection(d, section.id, dir), `Section moved ${dir}`)
            }
            onRequestDelete={() => setConfirm({ kind: "deleteSection", sectionId: section.id })}
            onMoveWidget={(widgetId, dir) =>
              apply((d) => moveWidget(d, section.id, widgetId, dir), `Widget moved ${dir}`)
            }
            onToggleHidden={(widgetId) =>
              apply((d) => toggleWidgetHidden(d, widgetId), "Widget visibility changed")
            }
            onSetSize={(widgetId, size: WidgetSizeToken) =>
              apply((d) => setWidgetSize(d, widgetId, size), "Widget size changed")
            }
            onMoveWidgetToSection={(widgetId, targetId) =>
              apply((d) => moveWidgetToSection(d, widgetId, targetId), "Widget moved to section")
            }
          />
        ))}
      </div>

      <div className="border-border bg-surface-2/20 rounded-xl border border-dashed p-4">
        <label htmlFor="new-section" className="text-muted mb-1 block text-xs font-medium">
          Add a section
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="new-section"
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddSection();
              }
            }}
            placeholder="New section name"
            className="h-9 max-w-xs"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            disabled={newSectionTitle.trim() === ""}
            onClick={onAddSection}
          >
            Add section
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmProps !== null}
        title={confirmProps?.title ?? ""}
        description={confirmProps?.description}
        confirmLabel={confirmProps?.confirmLabel}
        tone="danger"
        onConfirm={confirmProps?.onConfirm ?? (() => setConfirm(null))}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
