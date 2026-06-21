"use client";

import { useState } from "react";
import type { ResolvedSection, WidgetSizeToken } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WidgetEditorCard } from "./widget-editor-card";

interface SectionOption {
  id: string;
  label: string;
}

interface SectionEditorProps {
  section: ResolvedSection;
  index: number;
  total: number;
  isDefaultSection: boolean;
  canDelete: boolean;
  sectionOptions: SectionOption[];
  onRename: (title: string) => void;
  onMoveSection: (dir: "up" | "down") => void;
  onRequestDelete: () => void;
  onMoveWidget: (widgetId: string, dir: "up" | "down") => void;
  onToggleHidden: (widgetId: string) => void;
  onSetSize: (widgetId: string, size: WidgetSizeToken) => void;
  onMoveWidgetToSection: (widgetId: string, targetSectionId: string) => void;
  onRemoveWidget: (widgetId: string) => void;
}

export function SectionEditor({
  section,
  index,
  total,
  isDefaultSection,
  canDelete,
  sectionOptions,
  onRename,
  onMoveSection,
  onRequestDelete,
  onMoveWidget,
  onToggleHidden,
  onSetSize,
  onMoveWidgetToSection,
  onRemoveWidget,
}: SectionEditorProps) {
  const [name, setName] = useState(section.title);
  const titleId = `section-title-${section.id}`;
  const trimmed = name.trim();
  const renameDisabled = name === section.title || (!isDefaultSection && trimmed === "");

  return (
    <section
      className="border-border bg-surface-2/20 rounded-xl border p-4"
      aria-labelledby={titleId}
    >
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[12rem] flex-1">
          <label
            id={titleId}
            htmlFor={`rename-${section.id}`}
            className="text-muted mb-1 block text-xs font-medium"
          >
            {isDefaultSection ? "Section heading (optional)" : "Section heading"}
          </label>
          <div className="flex items-center gap-2">
            <Input
              id={`rename-${section.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isDefaultSection ? "No heading" : "Section name"}
              className="h-9"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={renameDisabled}
              onClick={() => onRename(trimmed)}
            >
              Rename
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 px-0"
            disabled={index === 0}
            aria-label="Move section up"
            onClick={() => onMoveSection("up")}
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 px-0"
            disabled={index === total - 1}
            aria-label="Move section down"
            onClick={() => onMoveSection("down")}
          >
            ↓
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            disabled={!canDelete}
            aria-label="Delete section"
            title={canDelete ? "Delete this section" : "Only empty sections can be deleted"}
            onClick={onRequestDelete}
          >
            Delete
          </Button>
        </div>
      </header>

      {section.widgets.length === 0 ? (
        <p className="border-border bg-surface-2/30 text-muted rounded-lg border border-dashed px-4 py-6 text-center text-sm">
          No widgets in this section. Move one here, or delete this section.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {section.widgets.map((widget, i) => (
            <WidgetEditorCard
              key={widget.id}
              widget={widget}
              sectionId={section.id}
              sections={sectionOptions}
              isFirst={i === 0}
              isLast={i === section.widgets.length - 1}
              onMove={(dir) => onMoveWidget(widget.id, dir)}
              onToggleHidden={() => onToggleHidden(widget.id)}
              onSetSize={(size) => onSetSize(widget.id, size)}
              onMoveToSection={(targetId) => onMoveWidgetToSection(widget.id, targetId)}
              onRemove={widget.instanceable ? () => onRemoveWidget(widget.id) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
