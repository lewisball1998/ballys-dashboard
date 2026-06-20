"use client";

import type { CategoryDTO, DockerImportCandidateDTO, DockerPortDTO } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatPort, healthMeta, stateMeta } from "@/components/docker/docker-logic";
import {
  appUrl,
  hostBaseIssue,
  publishedPorts,
  selectedPortLoopback,
  type ImportFieldErrors,
  type ImportRow,
  type ImportRowValues,
} from "./import-logic";

interface CandidateCardProps {
  candidate: DockerImportCandidateDTO;
  row: ImportRow;
  categories: CategoryDTO[];
  errors?: ImportFieldErrors;
  onToggle: (selected: boolean) => void;
  onChange: <K extends keyof ImportRowValues>(key: K, value: ImportRowValues[K]) => void;
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{messages.join(", ")}</p>;
}

function scopeLabel(port: DockerPortDTO): string {
  if (port.publicPort == null) return "internal only";
  if (port.hostScope === "loopback") return "Docker host only";
  return "published on host";
}

export function CandidateCard({
  candidate,
  row,
  categories,
  errors,
  onToggle,
  onChange,
}: CandidateCardProps) {
  const state = stateMeta(candidate.state);
  const health = healthMeta(candidate.health);
  const fieldId = (f: string) => `import-${candidate.containerId}-${f}`;
  const values = row.values;

  const published = publishedPorts(candidate);
  const generatedUrl = appUrl(candidate, values);
  const hostIssue = hostBaseIssue(values.hostBase);
  const portLoopback = selectedPortLoopback(candidate, values);

  return (
    <Card className={row.selected ? "ring-1 ring-accent/40" : undefined}>
      {/* --- Header: select + read-only Docker hints --- */}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0"
          checked={row.selected}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={`Select ${candidate.containerName} for import`}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium text-foreground">{candidate.containerName}</span>
            <Badge tone={state.tone}>{state.label}</Badge>
            {health ? <Badge tone={health.tone}>{health.label}</Badge> : null}
            {candidate.likelyInternal ? (
              <Badge tone="warning" dot={false} title={candidate.internalReason ?? undefined}>
                Likely internal service
              </Badge>
            ) : null}
            {candidate.alreadyImported ? (
              <Badge tone="info" dot={false} title={candidate.duplicateReason ?? undefined}>
                Already in Apps
              </Badge>
            ) : null}
          </div>

          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-2">
            <div className="truncate">
              <span className="text-muted/70">Image:</span> {candidate.image}
            </div>
            {candidate.composeProject ? (
              <div className="truncate">
                <span className="text-muted/70">Project:</span> {candidate.composeProject}
                {candidate.composeService ? ` / ${candidate.composeService}` : ""}
              </div>
            ) : null}
            <div className="truncate sm:col-span-2">
              <span className="text-muted/70">Ports:</span>{" "}
              {candidate.ports.length > 0
                ? candidate.ports.map((p) => `${formatPort(p)} (${scopeLabel(p)})`).join(", ")
                : "none published"}
            </div>
          </dl>

          {candidate.likelyInternal && candidate.internalReason ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">{candidate.internalReason}.</p>
          ) : null}
          {candidate.alreadyImported && candidate.duplicateReason ? (
            <p className="text-xs text-sky-600 dark:text-sky-400">
              {candidate.duplicateReason}. It will be skipped unless you change the name/URL.
            </p>
          ) : null}
        </div>
      </div>

      {/* --- Editable fields (only matter when selected) --- */}
      {row.selected ? (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium" htmlFor={fieldId("name")}>
                App name
              </label>
              <Input
                id={fieldId("name")}
                value={values.name}
                onChange={(e) => onChange("name", e.target.value)}
              />
              <FieldError messages={errors?.name} />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor={fieldId("cat")}>
                Category
              </label>
              <Select
                id={fieldId("cat")}
                value={values.categoryId == null ? "" : String(values.categoryId)}
                onChange={(e) =>
                  onChange("categoryId", e.target.value === "" ? null : Number(e.target.value))
                }
              >
                <option value="">Uncategorised</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* --- URL builder --- */}
          <div className="space-y-3 rounded-lg border border-border bg-surface-2/20 p-3">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium">App URL</span>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name={fieldId("urlmode")}
                  checked={values.urlMode === "port"}
                  onChange={() => onChange("urlMode", "port")}
                  disabled={published.length === 0}
                />
                Use detected port
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name={fieldId("urlmode")}
                  checked={values.urlMode === "custom"}
                  onChange={() => onChange("urlMode", "custom")}
                />
                Custom URL
              </label>
            </div>

            {values.urlMode === "port" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-medium text-muted" htmlFor={fieldId("scheme")}>
                      Scheme
                    </label>
                    <Select
                      id={fieldId("scheme")}
                      value={values.scheme}
                      onChange={(e) => onChange("scheme", e.target.value as ImportRowValues["scheme"])}
                    >
                      <option value="http">http</option>
                      <option value="https">https</option>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-muted" htmlFor={fieldId("host")}>
                      Docker host / base address
                    </label>
                    <Input
                      id={fieldId("host")}
                      value={values.hostBase}
                      onChange={(e) => onChange("hostBase", e.target.value)}
                      placeholder="e.g. 192.168.1.10 or nas.local"
                    />
                  </div>
                </div>

                {published.length > 1 ? (
                  <div>
                    <label className="text-xs font-medium text-muted" htmlFor={fieldId("port")}>
                      Published port
                    </label>
                    <Select
                      id={fieldId("port")}
                      value={String(values.portIndex)}
                      onChange={(e) => onChange("portIndex", Number(e.target.value))}
                    >
                      {candidate.ports.map((p, i) =>
                        p.publicPort != null ? (
                          <option key={i} value={String(i)}>
                            {formatPort(p)} ({scopeLabel(p)})
                          </option>
                        ) : null,
                      )}
                    </Select>
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    Port:{" "}
                    {published[0]
                      ? `${formatPort(published[0])} (${scopeLabel(published[0])})`
                      : "none"}
                  </p>
                )}

                <p className="text-xs text-muted">
                  Generated URL (a suggestion — edit the host/base to your real LAN address):{" "}
                  {generatedUrl ? (
                    <code className="text-foreground/80">{generatedUrl}</code>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">enter a host/base above</span>
                  )}
                </p>

                {hostIssue === "empty" ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Enter your NAS/server LAN hostname or IP — the generated URL needs a real address.
                  </p>
                ) : hostIssue === "loopback" ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    This host points at the dashboard itself — generated URLs may not work from other
                    devices. Use your NAS/server LAN hostname or IP.
                  </p>
                ) : null}
                {portLoopback ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    This port is published to <code>127.0.0.1</code> — the service may only be
                    reachable from the Docker host itself.
                  </p>
                ) : null}
              </div>
            ) : (
              <div>
                <Input
                  value={values.customUrl}
                  onChange={(e) => onChange("customUrl", e.target.value)}
                  placeholder="https://plex.example.com"
                />
                <p className="mt-1 text-xs text-muted">
                  Full URL, e.g. a reverse-proxy address. This is the App URL as-is.
                </p>
              </div>
            )}
            <FieldError messages={errors?.url} />
          </div>

          {/* --- Health URL --- */}
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.healthSameAsApp}
                onChange={(e) => onChange("healthSameAsApp", e.target.checked)}
              />
              Health URL same as App URL
            </label>
            {!values.healthSameAsApp ? (
              <div className="mt-2">
                <Input
                  value={values.healthUrl}
                  onChange={(e) => onChange("healthUrl", e.target.value)}
                  placeholder="https://app.example.com/health"
                />
                <FieldError messages={errors?.healthUrl} />
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.isFavourite}
                onChange={(e) => onChange("isFavourite", e.target.checked)}
              />
              Favourite
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.healthEnabled}
                onChange={(e) => onChange("healthEnabled", e.target.checked)}
              />
              Health checks
            </label>
          </div>

          <div className="rounded-lg border border-border bg-surface-2/30 p-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={values.healthInsecureTls}
                onChange={(e) => onChange("healthInsecureTls", e.target.checked)}
              />
              <span>
                Allow self-signed TLS for this health check
                <span className="mt-0.5 block text-xs text-muted">
                  For trusted internal services only. Skips TLS verification for this app&rsquo;s
                  health check only — every other check keeps secure verification.
                </span>
              </span>
            </label>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
