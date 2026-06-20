import { sql } from "drizzle-orm";
import { db } from "@/db";
import { apps, categories, settings } from "@/db/schema";
import { SETTING_KEYS } from "@/lib/constants";
import type { SetupSeedResultDTO, SetupStatusDTO } from "@/lib/types";
import type { SettingsUpdateInput } from "@/lib/validation";
import { STARTER_TEMPLATES, getTemplate, type TemplateId } from "@/server/setup/templates";
import { getSettings, updateSettings } from "./settings";

function countOf(table: typeof apps | typeof categories): number {
  return db.select({ c: sql<number>`count(*)` }).from(table).get()?.c ?? 0;
}

export function getSetupStatus(): SetupStatusDTO {
  const s = getSettings();
  return {
    setupCompleted: s.setupCompleted,
    dashboardName: s.dashboardName,
    theme: s.theme,
    accent: s.accent,
    timezone: s.timezone,
    logoPath: s.logoPath,
    appCount: countOf(apps),
    categoryCount: countOf(categories),
    templates: STARTER_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      categories: t.categories,
    })),
  };
}

/**
 * Mark setup complete. Idempotent (upsert). Optionally applies final settings
 * first (validated by the caller). Never touches existing apps/categories.
 */
export function completeSetup(finalSettings?: SettingsUpdateInput): SetupStatusDTO {
  if (finalSettings) updateSettings(finalSettings);
  const now = new Date();
  db.insert(settings)
    .values({ key: SETTING_KEYS.setupCompleted, value: "true", updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value: "true", updatedAt: now } })
    .run();
  return getSetupStatus();
}

/**
 * Seed a template's generic starter categories. Idempotent: categories whose
 * name already exists (case-insensitive) are skipped, so re-running never
 * duplicates and never overwrites user-created categories.
 */
export function seedFromTemplate(templateId: TemplateId): SetupSeedResultDTO {
  const template = getTemplate(templateId);
  const existing = new Set(
    db
      .select({ name: categories.name })
      .from(categories)
      .all()
      .map((c) => c.name.toLowerCase()),
  );
  let nextOrder =
    (db.select({ m: sql<number | null>`max(${categories.sortOrder})` }).from(categories).get()?.m ?? -1) + 1;

  let created = 0;
  let skipped = 0;
  const now = new Date();
  for (const name of template.categories) {
    if (existing.has(name.toLowerCase())) {
      skipped += 1;
      continue;
    }
    db.insert(categories).values({ name, sortOrder: nextOrder, createdAt: now, updatedAt: now }).run();
    existing.add(name.toLowerCase());
    nextOrder += 1;
    created += 1;
  }

  return { template: templateId, categoriesCreated: created, categoriesSkipped: skipped };
}
