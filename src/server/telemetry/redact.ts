/**
 * Redaction helpers for infrastructure telemetry (v0.3.0). Pure — unit tested.
 *
 * Sensitive host identifiers must never reach the client verbatim. Disk serials
 * are partially masked (enough to recognise a drive, not enough to fully
 * identify the unit), and free-text fields (models, GPU names) are stripped of
 * anything that looks like a filesystem path.
 */

/**
 * Redact a disk serial: keep a short head + tail, mask the middle. Short serials
 * (<= 6 chars) collapse to a fully masked token so we never leak a full id.
 *   "WD-WCC4E1234567" -> "WD…4567"
 *   "ABC123"          -> "••••"
 */
export function redactSerial(serial: string | null | undefined): string | null {
  if (!serial) return null;
  const s = serial.trim();
  if (s.length === 0) return null;
  if (s.length <= 6) return "••••";
  const head = s.slice(0, 2);
  const tail = s.slice(-4);
  return `${head}…${tail}`;
}

/**
 * Sanitise a free-text label (drive model, GPU name): trim, drop anything
 * resembling an absolute path or leaked secret, collapse whitespace, cap length.
 */
export function sanitiseLabel(label: string | null | undefined, maxLen = 64): string | null {
  if (!label) return null;
  let s = label.trim();
  if (s.length === 0) return null;
  // Drop absolute unix paths that may have leaked into a model/name string.
  if (/^\/(?:[\w.-]+\/?)+/.test(s)) return null;
  s = s.replace(/\s+/g, " ");
  if (s.length > maxLen) s = `${s.slice(0, maxLen - 1).trimEnd()}…`;
  return s;
}
