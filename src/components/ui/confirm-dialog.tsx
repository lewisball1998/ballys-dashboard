"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Minimal accessible confirmation dialog: focus-trapped, Escape to cancel,
 * overlay click to cancel, restores focus to the trigger on close. No portal —
 * a fixed overlay above the app chrome is sufficient. Used for Reset/discard.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const buttons = () => Array.from(panel?.querySelectorAll<HTMLElement>("button") ?? []);
    buttons()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === "Tab") {
        const items = buttons();
        if (items.length === 0) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      restoreRef.current?.focus?.();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="border-border bg-surface relative w-full max-w-sm rounded-xl border p-5 shadow-lg shadow-black/20"
      >
        <h2 id={titleId} className="text-foreground text-base font-semibold">
          {title}
        </h2>
        {description ? (
          <p id={descId} className="text-muted mt-2 text-sm">
            {description}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            className={cn(
              tone === "danger" &&
                "bg-rose-600 text-white shadow-rose-600/20 hover:bg-rose-500 hover:opacity-100",
            )}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
