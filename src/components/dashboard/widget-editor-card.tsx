"use client";

import type { ResolvedWidget, WidgetSizeToken } from "@/lib/types";
import { SIZE_TOKEN_LABELS, WIDGET_SIZE_TOKENS } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

interface SectionOption {
  id: string;
  label: string;
}

interface WidgetEditorCardProps {
  widget: ResolvedWidget;
  sectionId: string;
  sections: SectionOption[];
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: "up" | "down") => void;
  onToggleHidden: () => void;
  onSetSize: (size: WidgetSizeToken) => void;
  onMoveToSection: (targetSectionId: string) => void;
}

function SizeControl({
  value,
  onChange,
  describedById,
}: {
  value: WidgetSizeToken;
  onChange: (size: WidgetSizeToken) => void;
  describedById: string;
}) {
  return (
    <div>
      <span id={describedById} className="text-muted mb-1 block text-xs font-medium">
        Size
      </span>
      {/* Desktop: segmented radiogroup */}
      <div
        role="radiogroup"
        aria-labelledby={describedById}
        className="border-border hidden overflow-hidden rounded-md border sm:inline-flex"
      >
        {WIDGET_SIZE_TOKENS.map((token) => {
          const active = token === value;
          return (
            <button
              key={token}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(token)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium transition-colors",
                "focus-visible:ring-accent/50 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
                "border-border border-l first:border-l-0",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground/70 hover:bg-foreground/[0.06]",
              )}
            >
              {SIZE_TOKEN_LABELS[token]}
            </button>
          );
        })}
      </div>
      {/* Mobile: native select */}
      <Select
        aria-labelledby={describedById}
        value={value}
        onChange={(e) => onChange(e.target.value as WidgetSizeToken)}
        className="h-9 sm:hidden"
      >
        {WIDGET_SIZE_TOKENS.map((token) => (
          <option key={token} value={token}>
            {SIZE_TOKEN_LABELS[token]}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function WidgetEditorCard({
  widget,
  sectionId,
  sections,
  isFirst,
  isLast,
  onMove,
  onToggleHidden,
  onSetSize,
  onMoveToSection,
}: WidgetEditorCardProps) {
  const sizeLabelId = `size-${widget.id}`;
  const moveLabelId = `move-${widget.id}`;

  return (
    <div
      className={cn(
        "border-border bg-surface rounded-lg border p-3 transition-opacity",
        widget.hidden && "opacity-60",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-foreground truncate text-sm font-semibold">{widget.title}</span>
          {widget.hidden ? (
            <Badge tone="neutral" dot={false}>
              Hidden
            </Badge>
          ) : null}
        </div>
        <Button
          variant={widget.hidden ? "primary" : "outline"}
          size="sm"
          aria-pressed={widget.hidden}
          aria-label={widget.hidden ? `Show ${widget.title}` : `Hide ${widget.title}`}
          onClick={onToggleHidden}
        >
          {widget.hidden ? "Show" : "Hide"}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <SizeControl value={widget.size} onChange={onSetSize} describedById={sizeLabelId} />

        <div>
          <span id={moveLabelId} className="text-muted mb-1 block text-xs font-medium">
            Order
          </span>
          <div className="inline-flex gap-1" aria-labelledby={moveLabelId}>
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 px-0"
              disabled={isFirst}
              aria-label={`Move ${widget.title} up`}
              onClick={() => onMove("up")}
            >
              ↑
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 px-0"
              disabled={isLast}
              aria-label={`Move ${widget.title} down`}
              onClick={() => onMove("down")}
            >
              ↓
            </Button>
          </div>
        </div>

        {sections.length > 1 ? (
          <div className="min-w-[10rem] flex-1">
            <label
              htmlFor={`move-section-${widget.id}`}
              className="text-muted mb-1 block text-xs font-medium"
            >
              Move to section
            </label>
            <Select
              id={`move-section-${widget.id}`}
              value={sectionId}
              onChange={(e) => onMoveToSection(e.target.value)}
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
      </div>
    </div>
  );
}
