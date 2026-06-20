import type { DockerImportCandidateDTO, DockerPortDTO } from "@/lib/types";
import { dockerImportItemSchema, type DockerImportItemInput } from "@/lib/validation";

/**
 * Pure logic for the Import-from-Docker flow (no React) so it is unit-testable.
 *
 * The app URL is built from clear parts the user controls — scheme + a "Docker
 * host / base address" + a chosen published port — OR a full custom URL (for
 * reverse proxies). We deliberately never default the host to `localhost`,
 * `0.0.0.0`, or `::`: server-side health checks run from inside the dashboard
 * container, where `localhost` is the container itself, and `0.0.0.0`/`::` are
 * "all interfaces" markers, not reachable hostnames. The default host/base comes
 * from the dashboard's own hostname (see docker-import.tsx).
 */

export type UrlScheme = "http" | "https";
export type UrlMode = "port" | "custom";

export interface ImportRowValues {
  name: string;
  categoryId: number | null;
  isFavourite: boolean;
  healthEnabled: boolean;
  healthInsecureTls: boolean;
  // App URL builder
  urlMode: UrlMode;
  scheme: UrlScheme;
  hostBase: string;
  /** Index into {@link publishedPorts}(candidate); -1 when none. */
  portIndex: number;
  customUrl: string;
  // Health URL
  healthSameAsApp: boolean;
  healthUrl: string;
}

export interface ImportRow {
  selected: boolean;
  values: ImportRowValues;
}

/** The published ports of a candidate (those with a host port), in display order. */
export function publishedPorts(candidate: DockerImportCandidateDTO): DockerPortDTO[] {
  return candidate.ports.filter((p) => p.publicPort != null);
}

/** Default scheme for a host port: 443 → https, 80 (and everything else) → http. */
export function defaultSchemeForPort(publicPort: number): UrlScheme {
  return publicPort === 443 ? "https" : "http";
}

/** Index of the best published port to preselect (well-known web ports first). */
export function pickDefaultPortIndex(ports: DockerPortDTO[]): number {
  const published = ports.filter((p) => p.publicPort != null);
  if (published.length === 0) return -1;
  const priority = (pub: number): number => {
    if (pub === 443) return 0;
    if (pub === 80) return 1;
    if (pub === 8080 || pub === 8443) return 2;
    return 3;
  };
  let bestPort = published[0]!;
  for (const p of published) {
    if (
      priority(p.publicPort!) < priority(bestPort.publicPort!) ||
      (priority(p.publicPort!) === priority(bestPort.publicPort!) && p.publicPort! < bestPort.publicPort!)
    ) {
      bestPort = p;
    }
  }
  return ports.indexOf(bestPort);
}

/** Compose a URL from parts, omitting the port for the scheme's default. Returns
 * "" when the host is blank (so the caller surfaces a "needs a host" state). */
export function composeUrl(scheme: UrlScheme, hostBase: string, port: number): string {
  const host = hostBase.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!host) return "";
  const isDefault = (scheme === "http" && port === 80) || (scheme === "https" && port === 443);
  return isDefault ? `${scheme}://${host}` : `${scheme}://${host}:${port}`;
}

/** The effective App URL for a row (custom URL, or composed from the parts). */
export function appUrl(candidate: DockerImportCandidateDTO, values: ImportRowValues): string {
  if (values.urlMode === "custom") return values.customUrl.trim();
  const port = candidate.ports[values.portIndex];
  if (!port || port.publicPort == null) return "";
  return composeUrl(values.scheme, values.hostBase, port.publicPort);
}

/** The effective Health URL: blank means "fall back to the App URL" server-side. */
export function healthUrlValue(values: ImportRowValues): string {
  return values.healthSameAsApp ? "" : values.healthUrl.trim();
}

/**
 * Why a host/base address is unusable, or null when it's fine. `localhost` /
 * loopback / unspecified addresses produce URLs that won't work from other
 * devices (and break server-side health checks).
 */
export function hostBaseIssue(hostBase: string): "empty" | "loopback" | null {
  const host = hostBase.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!host) return "empty";
  if (["localhost", "127.0.0.1", "::1", "0.0.0.0", "::"].includes(host)) return "loopback";
  return null;
}

/** Is the currently-selected published port bound to loopback only on the host? */
export function selectedPortLoopback(
  candidate: DockerImportCandidateDTO,
  values: ImportRowValues,
): boolean {
  if (values.urlMode !== "port") return false;
  return candidate.ports[values.portIndex]?.hostScope === "loopback";
}

/**
 * Seed a row from the server's suggestions + the dashboard's default host/base.
 * Nothing is selected by default — the user must opt each candidate in. When no
 * port is published the row starts in custom-URL mode.
 */
export function candidateToRow(
  candidate: DockerImportCandidateDTO,
  defaultHostBase: string,
): ImportRow {
  const portIndex = pickDefaultPortIndex(candidate.ports);
  const hasPort = portIndex >= 0;
  const port = hasPort ? candidate.ports[portIndex]! : null;
  return {
    selected: false,
    values: {
      name: candidate.suggestedName,
      categoryId: null,
      isFavourite: false,
      healthEnabled: false,
      healthInsecureTls: false,
      urlMode: hasPort ? "port" : "custom",
      scheme: port?.publicPort != null ? defaultSchemeForPort(port.publicPort) : "http",
      hostBase: defaultHostBase,
      portIndex,
      customUrl: "",
      healthSameAsApp: true,
      healthUrl: "",
    },
  };
}

/** Build the rows map keyed by container id. */
export function buildRows(
  candidates: DockerImportCandidateDTO[],
  defaultHostBase: string,
): Record<string, ImportRow> {
  const rows: Record<string, ImportRow> = {};
  for (const c of candidates) rows[c.containerId] = candidateToRow(c, defaultHostBase);
  return rows;
}

/** The app-create payload (+ source container id) for a row. */
export function buildImportItem(
  candidate: DockerImportCandidateDTO,
  values: ImportRowValues,
): Record<string, unknown> {
  return {
    containerId: candidate.containerId,
    name: values.name.trim(),
    url: appUrl(candidate, values),
    categoryId: values.categoryId,
    isFavourite: values.isFavourite,
    healthEnabled: values.healthEnabled,
    healthUrl: healthUrlValue(values) || null,
    healthInsecureTls: values.healthInsecureTls,
  };
}

export type ImportFieldErrors = Partial<Record<"name" | "url" | "healthUrl" | "form", string[]>>;

export type RowValidation =
  | { success: true; item: DockerImportItemInput }
  | { success: false; fieldErrors: ImportFieldErrors };

/** Validate one selected row with the shared import item schema (same rules as a
 * hand-added app, e.g. a required http(s) URL). */
export function validateRow(
  candidate: DockerImportCandidateDTO,
  values: ImportRowValues,
): RowValidation {
  const result = dockerImportItemSchema.safeParse(buildImportItem(candidate, values));
  if (result.success) return { success: true, item: result.data };
  const fieldErrors: ImportFieldErrors = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form") as keyof ImportFieldErrors;
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { success: false, fieldErrors };
}

export function selectedIds(rows: Record<string, ImportRow>): string[] {
  return Object.entries(rows)
    .filter(([, row]) => row.selected)
    .map(([id]) => id);
}
