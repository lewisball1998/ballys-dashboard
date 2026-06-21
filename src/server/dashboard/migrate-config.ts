import { CURRENT_LAYOUT_VERSION } from "@/lib/dashboard";

/**
 * Upgrade an older persisted/imported layout document to the current shape BEFORE
 * schema validation. This is the load-bearing piece that keeps stored layouts and
 * future imported layouts forward-compatible across config versions.
 *
 * v1 is the only version today, so this is effectively identity. When the document
 * shape changes, bump CURRENT_LAYOUT_VERSION and add a step per old version here.
 * Must stay pure and defensive: it receives untrusted/unknown input.
 */
export function migrateLayoutConfig(raw: unknown): unknown {
  if (raw == null || typeof raw !== "object") return raw;
  const doc = raw as { version?: unknown };
  const version = typeof doc.version === "number" ? doc.version : 0;

  // No historical migrations yet. Future example:
  //   if (version < 2) { /* transform v1 -> v2 */ }
  void version;
  void CURRENT_LAYOUT_VERSION;

  return doc;
}
