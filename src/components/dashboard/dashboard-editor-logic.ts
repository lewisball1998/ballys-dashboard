import { CURRENT_LAYOUT_VERSION, sizeTokenToColumns } from "@/lib/dashboard";
import type {
  DashboardLayoutConfig,
  DashboardLayoutDTO,
  ResolvedWidget,
  WidgetSizeToken,
} from "@/lib/types";

/**
 * Pure, React-free transforms for the dashboard editor draft. ⭐ Unit-tested.
 *
 * The editor draft is a `DashboardLayoutDTO` (the same resolved shape the grid
 * consumes) so widget titles/components are available while editing. Array order
 * is the source of truth; numeric `order` is (re)assigned by index at save time
 * via `dtoToConfig`. Every function returns a new object and never mutates input.
 * `config` here means the persisted `DashboardLayoutConfig` (PUT body) — this
 * module never changes that document shape.
 */
export type Draft = DashboardLayoutDTO;
export type MoveDirection = "up" | "down";

function clone(dto: Draft): Draft {
  return JSON.parse(JSON.stringify(dto)) as Draft;
}

function swap<T>(arr: T[], i: number, j: number): void {
  const a = arr[i]!;
  const b = arr[j]!;
  arr[i] = b;
  arr[j] = a;
}

/** Map the editor draft → the persisted config (strips render-only fields,
 *  renumbers section + widget orders contiguously by array position). */
export function dtoToConfig(dto: Draft): DashboardLayoutConfig {
  return {
    version: dto.version || CURRENT_LAYOUT_VERSION,
    sections: dto.sections.map((section, si) => ({
      id: section.id,
      title: section.title,
      order: si,
      widgets: section.widgets.map((w, wi) => ({
        id: w.id,
        widgetKey: w.widgetKey,
        hidden: w.hidden,
        size: w.size,
        order: wi,
        config: w.config ?? {},
      })),
    })),
  };
}

/** Structural dirty check: compares the normalised persisted shape only. */
export function isDirty(draft: Draft, baseline: Draft): boolean {
  return JSON.stringify(dtoToConfig(draft)) !== JSON.stringify(dtoToConfig(baseline));
}

/** Build a unique, schema-valid section id (slug `[A-Za-z0-9:_-]`) from a title. */
export function slugifySectionId(title: string, existingIds: string[]): string {
  const base =
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9:_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100) || "section";
  const taken = new Set(existingIds);
  let candidate = base;
  let n = 2;
  while (taken.has(candidate)) candidate = `${base}-${n++}`;
  return candidate;
}

// --- Section operations -------------------------------------------------------

export function addSection(dto: Draft, title: string): Draft {
  const id = slugifySectionId(
    title,
    dto.sections.map((s) => s.id),
  );
  const next = clone(dto);
  next.sections.push({ id, title: title.trim(), order: next.sections.length, widgets: [] });
  return next;
}

export function renameSection(dto: Draft, sectionId: string, title: string): Draft {
  const next = clone(dto);
  const section = next.sections.find((s) => s.id === sectionId);
  if (section) section.title = title;
  return next;
}

export function moveSection(dto: Draft, sectionId: string, dir: MoveDirection): Draft {
  const i = dto.sections.findIndex((s) => s.id === sectionId);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= dto.sections.length) return dto;
  const next = clone(dto);
  swap(next.sections, i, j);
  return next;
}

/** Deletable only when empty and not the last remaining section (schema needs ≥1). */
export function canDeleteSection(dto: Draft, sectionId: string): boolean {
  const section = dto.sections.find((s) => s.id === sectionId);
  return Boolean(section) && section!.widgets.length === 0 && dto.sections.length > 1;
}

export function deleteSection(dto: Draft, sectionId: string): Draft {
  if (!canDeleteSection(dto, sectionId)) return dto;
  const next = clone(dto);
  next.sections = next.sections.filter((s) => s.id !== sectionId);
  return next;
}

// --- Widget operations --------------------------------------------------------

export function moveWidget(
  dto: Draft,
  sectionId: string,
  widgetId: string,
  dir: MoveDirection,
): Draft {
  const section = dto.sections.find((s) => s.id === sectionId);
  if (!section) return dto;
  const i = section.widgets.findIndex((w) => w.id === widgetId);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= section.widgets.length) return dto;
  const next = clone(dto);
  const target = next.sections.find((s) => s.id === sectionId)!;
  swap(target.widgets, i, j);
  return next;
}

export function moveWidgetToSection(dto: Draft, widgetId: string, targetSectionId: string): Draft {
  const source = dto.sections.find((s) => s.widgets.some((w) => w.id === widgetId));
  if (!source || source.id === targetSectionId) return dto;
  if (!dto.sections.some((s) => s.id === targetSectionId)) return dto;
  const next = clone(dto);
  let moved: ResolvedWidget | undefined;
  for (const section of next.sections) {
    const i = section.widgets.findIndex((w) => w.id === widgetId);
    if (i >= 0) {
      moved = section.widgets.splice(i, 1)[0];
      break;
    }
  }
  if (!moved) return dto;
  next.sections.find((s) => s.id === targetSectionId)!.widgets.push(moved);
  return next;
}

export function toggleWidgetHidden(dto: Draft, widgetId: string): Draft {
  const next = clone(dto);
  for (const section of next.sections) {
    const widget = section.widgets.find((w) => w.id === widgetId);
    if (widget) {
      widget.hidden = !widget.hidden;
      break;
    }
  }
  return next;
}

export function setWidgetSize(dto: Draft, widgetId: string, size: WidgetSizeToken): Draft {
  const next = clone(dto);
  for (const section of next.sections) {
    const widget = section.widgets.find((w) => w.id === widgetId);
    if (widget) {
      widget.size = size;
      widget.columns = sizeTokenToColumns(size);
      break;
    }
  }
  return next;
}
