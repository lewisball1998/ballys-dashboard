"use client";

import type { CategoryDTO, DockerImportCandidateDTO } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatPort, healthMeta, stateMeta } from "@/components/docker/docker-logic";
import type { AppFieldErrors, AppFormValues } from "@/components/launcher/launcher-logic";
import type { ImportRow } from "./import-logic";

interface CandidateCardProps {
  candidate: DockerImportCandidateDTO;
  row: ImportRow;
  categories: CategoryDTO[];
  errors?: AppFieldErrors;
  onToggle: (selected: boolean) => void;
  onChange: <K extends keyof AppFormValues>(key: K, value: AppFormValues[K]) => void;
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{messages.join(", ")}</p>;
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
              {candidate.ports.length > 0 ? candidate.ports.map(formatPort).join(", ") : "none published"}
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
                value={row.values.name}
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
                value={row.values.categoryId == null ? "" : String(row.values.categoryId)}
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

          <div>
            <label className="text-sm font-medium" htmlFor={fieldId("url")}>
              URL
            </label>
            <Input
              id={fieldId("url")}
              value={row.values.url}
              onChange={(e) => onChange("url", e.target.value)}
              placeholder="https://app.example.com"
            />
            <p className="mt-1 text-xs text-muted">
              Suggested from published ports — just a guess. Edit it to your real address, e.g. a
              reverse-proxy URL like <code>https://plex.example.com</code>.
            </p>
            <FieldError messages={errors?.url} />
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor={fieldId("health-url")}>
              Health URL (optional)
            </label>
            <Input
              id={fieldId("health-url")}
              value={row.values.healthUrl}
              onChange={(e) => onChange("healthUrl", e.target.value)}
              placeholder="Defaults to the URL above"
            />
            <FieldError messages={errors?.healthUrl} />
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={row.values.isFavourite}
                onChange={(e) => onChange("isFavourite", e.target.checked)}
              />
              Favourite
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={row.values.healthEnabled}
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
                checked={row.values.healthInsecureTls}
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
