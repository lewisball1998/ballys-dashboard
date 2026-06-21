"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CustomIconDTO, IconPackDTO } from "@/lib/types";
import { listBuiltinIcons } from "@/lib/icons/registry";
import { buildBuiltinRef, buildCustomRef, buildPackRef, parseIconRef } from "@/lib/icons/resolve";
import { suggestIconKey } from "@/lib/icons/suggest";
import { MAX_ICON_BYTES } from "@/lib/icons/upload";
import { MAX_PACK_ZIP_BYTES } from "@/lib/icons/pack-manifest";
import {
  deleteCustomIcon as apiDeleteCustomIcon,
  fetchCustomIcons,
  uploadCustomIcon,
} from "@/hooks/icons-api";
import {
  deleteIconPack as apiDeleteIconPack,
  fetchIconPacks,
  importIconPack,
} from "@/hooks/icon-packs-api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppIcon } from "./app-icon";

type Tab = "builtin" | "custom" | "packs" | "url" | "none";

function initialTab(value: string): Tab {
  const ref = parseIconRef(value);
  if (ref.kind === "builtin") return "builtin";
  if (ref.kind === "custom") return "custom";
  if (ref.kind === "pack") return "packs";
  if (ref.kind === "url" || ref.kind === "legacy") return "url";
  return "builtin";
}

const TABS: { id: Tab; label: string }[] = [
  { id: "builtin", label: "Library" },
  { id: "custom", label: "Custom" },
  { id: "packs", label: "Packs" },
  { id: "url", label: "URL" },
  { id: "none", label: "None" },
];

interface IconPickerProps {
  value: string;
  name: string;
  onChange: (value: string) => void;
}

export function IconPicker({ value, name, onChange }: IconPickerProps) {
  const [tab, setTab] = useState<Tab>(() => initialTab(value));
  const [search, setSearch] = useState("");
  const parsed = parseIconRef(value);

  const builtins = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = listBuiltinIcons();
    if (!q) return all;
    return all.filter(
      (i) =>
        i.key.includes(q) ||
        i.label.toLowerCase().includes(q) ||
        i.aliases.some((a) => a.includes(q)),
    );
  }, [search]);

  // Suggestion: only ever OFFERED, never auto-applied — and only when there is no
  // explicit choice yet (value empty), so a manual pick is never overwritten.
  const suggestionKey = value.trim() === "" ? suggestIconKey(name) : null;

  return (
    <div className="border-border bg-surface-2/30 rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <AppIcon icon={value || null} name={name || "?"} className="h-12 w-12 text-base" />
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-medium">Icon</p>
          <p className="text-muted truncate text-xs">
            {value.trim() === "" ? "Initials fallback" : value}
          </p>
        </div>
        {suggestionKey ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onChange(buildBuiltinRef(suggestionKey));
              setTab("builtin");
            }}
          >
            <span className="flex items-center gap-1.5">
              <AppIcon
                icon={buildBuiltinRef(suggestionKey)}
                name={name || "?"}
                className="h-4 w-4"
              />
              Use suggested
            </span>
          </Button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              tab === t.id
                ? "bg-accent text-accent-foreground"
                : "bg-foreground/5 text-muted hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {tab === "builtin" ? (
          <div>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons…"
              aria-label="Search built-in icons"
            />
            <div className="mt-2 grid max-h-44 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-6">
              {builtins.map((icon) => {
                const ref = buildBuiltinRef(icon.key);
                const selected = parsed.kind === "builtin" && parsed.key === icon.key;
                return (
                  <button
                    key={icon.key}
                    type="button"
                    title={icon.label}
                    onClick={() => onChange(ref)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-md border p-2 transition-colors",
                      selected
                        ? "border-accent bg-accent/10"
                        : "hover:bg-foreground/5 border-transparent",
                    )}
                  >
                    <AppIcon icon={ref} name={icon.label} className="h-7 w-7" />
                    <span className="text-muted w-full truncate text-center text-[10px]">
                      {icon.label}
                    </span>
                  </button>
                );
              })}
              {builtins.length === 0 ? (
                <p className="text-muted col-span-full py-4 text-center text-xs">No icons match.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === "custom" ? (
          <CustomIconsTab
            selectedId={parsed.kind === "custom" ? parsed.id : null}
            onSelect={(id) => onChange(buildCustomRef(id))}
          />
        ) : null}

        {tab === "packs" ? (
          <PacksTab
            selected={
              parsed.kind === "pack" ? { packId: parsed.packId, iconKey: parsed.iconKey } : null
            }
            onSelect={(packId, iconKey) => onChange(buildPackRef(packId, iconKey))}
          />
        ) : null}

        {tab === "url" ? (
          <div>
            <Input
              value={parsed.kind === "url" || parsed.kind === "legacy" ? value : ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://example.com/icon.png"
              aria-label="Icon URL"
            />
            <p className="text-muted mt-1 text-xs">
              Link to a remote image. Existing icon URLs keep working unchanged.
            </p>
          </div>
        ) : null}

        {tab === "none" ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted text-xs">
              Show the app&rsquo;s initial letter instead of an icon.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => onChange("")}>
              Use initials
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CustomIconsTab({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [icons, setIcons] = useState<CustomIconDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetchCustomIcons();
    if (res.ok) {
      setIcons(res.data.items);
      setError(null);
    } else {
      setError(res.error.message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    const res = await uploadCustomIcon(file);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (res.ok) {
      await load();
      onSelect(res.data.id);
    } else {
      setError(res.error.message);
    }
  };

  const onDelete = async (id: string) => {
    setBusy(true);
    await apiDeleteCustomIcon(id);
    setBusy(false);
    await load();
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/webp"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? "Uploading…" : "Upload icon"}
        </Button>
        <span className="text-muted text-xs">
          PNG or WebP, up to {Math.floor(MAX_ICON_BYTES / 1024)} KB.
        </span>
      </div>

      {error ? <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}

      <div className="mt-2 grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-6">
        {icons === null ? (
          <p className="text-muted col-span-full py-4 text-center text-xs">Loading…</p>
        ) : icons.length === 0 ? (
          <p className="text-muted col-span-full py-4 text-center text-xs">No custom icons yet.</p>
        ) : (
          icons.map((icon) => {
            const ref = `custom:${icon.id}`;
            const selected = selectedId === icon.id;
            return (
              <div key={icon.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(icon.id)}
                  className={cn(
                    "flex w-full items-center justify-center rounded-md border p-2 transition-colors",
                    selected
                      ? "border-accent bg-accent/10"
                      : "hover:bg-foreground/5 border-transparent",
                  )}
                >
                  <AppIcon icon={ref} name="?" className="h-7 w-7" />
                </button>
                <button
                  type="button"
                  aria-label="Delete icon"
                  disabled={busy}
                  onClick={() => void onDelete(icon.id)}
                  className="bg-foreground/70 text-background absolute -top-1 -right-1 hidden h-4 w-4 items-center justify-center rounded-full text-[10px] group-hover:flex"
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function PacksTab({
  selected,
  onSelect,
}: {
  selected: { packId: string; iconKey: string } | null;
  onSelect: (packId: string, iconKey: string) => void;
}) {
  const [packs, setPacks] = useState<IconPackDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetchIconPacks();
    if (res.ok) {
      setPacks(res.data.items);
      setError(null);
    } else {
      setError(res.error.message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    const res = await importIconPack(file);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (res.ok) {
      await load();
      if (res.data.icons[0]) onSelect(res.data.id, res.data.icons[0].key);
    } else {
      setError(res.error.message);
    }
  };

  const onDeletePack = async (id: string) => {
    setBusy(true);
    await apiDeleteIconPack(id);
    setBusy(false);
    await load();
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? "Working…" : "Import pack (.zip)"}
        </Button>
        <span className="text-muted text-xs">
          Local .zip, PNG/WebP icons, up to {Math.floor(MAX_PACK_ZIP_BYTES / 1024 / 1024)} MB.
        </span>
      </div>

      {error ? <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}

      <div className="mt-2 max-h-56 space-y-3 overflow-y-auto">
        {packs === null ? (
          <p className="text-muted py-4 text-center text-xs">Loading…</p>
        ) : packs.length === 0 ? (
          <p className="text-muted py-4 text-center text-xs">No packs imported yet.</p>
        ) : (
          packs.map((pack) => (
            <div key={pack.id} className="border-border rounded-md border p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-foreground truncate text-xs font-medium">
                    {pack.name} <span className="text-muted font-normal">v{pack.version}</span>
                  </p>
                  <p className="text-muted truncate text-[10px]">
                    {[
                      pack.author ? `by ${pack.author}` : null,
                      pack.license,
                      `${pack.iconCount} icon${pack.iconCount === 1 ? "" : "s"}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    {pack.homepage ? (
                      <>
                        {" · "}
                        <a
                          href={pack.homepage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-foreground underline"
                        >
                          homepage
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void onDeletePack(pack.id)}
                >
                  Delete
                </Button>
              </div>

              <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {pack.icons.map((icon) => {
                  const isSelected = selected?.packId === pack.id && selected?.iconKey === icon.key;
                  return (
                    <button
                      key={icon.key}
                      type="button"
                      title={icon.label ?? icon.key}
                      onClick={() => onSelect(pack.id, icon.key)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-md border p-2 transition-colors",
                        isSelected
                          ? "border-accent bg-accent/10"
                          : "hover:bg-foreground/5 border-transparent",
                      )}
                    >
                      <AppIcon
                        icon={buildPackRef(pack.id, icon.key)}
                        name={icon.label ?? icon.key}
                        className="h-7 w-7"
                      />
                      <span className="text-muted w-full truncate text-center text-[10px]">
                        {icon.label ?? icon.key}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
