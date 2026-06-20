"use client";

import { useMemo, useState } from "react";
import type { AppDTO } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { reorderApps } from "@/hooks/launcher-api";
import { useLauncher, type LauncherFilter } from "@/hooks/use-launcher";
import { AppCard } from "./app-card";
import { AppForm } from "./app-form";
import { CategoryManager } from "./category-manager";
import { appToForm, emptyAppForm, groupAppsByCategory, type AppFormValues } from "./launcher-logic";

interface FormState {
  open: boolean;
  editingId: number | null;
  initial: AppFormValues;
}

const CLOSED: FormState = { open: false, editingId: null, initial: emptyAppForm() };

export function Launcher() {
  const [lifecycle, setLifecycle] = useState<LauncherFilter["lifecycle"]>("active");
  const [showHidden, setShowHidden] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [form, setForm] = useState<FormState>(CLOSED);

  const filter: LauncherFilter = { lifecycle, includeHidden: showHidden };
  const { categories, apps, loading, error, reload } = useLauncher(filter);

  const groups = useMemo(() => groupAppsByCategory(apps, categories), [apps, categories]);

  const openCreate = () => setForm({ open: true, editingId: null, initial: emptyAppForm() });
  const openEdit = (app: AppDTO) => setForm({ open: true, editingId: app.id, initial: appToForm(app) });

  const moveApp = async (app: AppDTO, direction: "up" | "down") => {
    const group = groups.find((g) => (g.category?.id ?? null) === (app.categoryId ?? null));
    if (!group) return;
    const ids = group.apps.map((a) => a.id);
    const index = ids.indexOf(app.id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    await reorderApps({ categoryId: app.categoryId, ids });
    reload();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Apps</h1>
          <p className="text-sm text-foreground/60">Your application launcher.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Lifecycle filter"
            value={lifecycle}
            onChange={(e) => setLifecycle(e.target.value as LauncherFilter["lifecycle"])}
            className="h-9 w-auto"
          >
            <option value="active">Active</option>
            <option value="all">All</option>
            <option value="retired">Retired</option>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
            Show hidden
          </label>
          <Button variant="outline" size="sm" onClick={() => setShowCategories((v) => !v)}>
            {showCategories ? "Hide categories" : "Manage categories"}
          </Button>
          <Button size="sm" onClick={openCreate}>
            Add app
          </Button>
        </div>
      </header>

      {showCategories ? <CategoryManager categories={categories} onChanged={reload} /> : null}

      {loading && apps.length === 0 && categories.length === 0 ? (
        <LoadingState label="Loading launcher…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : groups.length === 0 ? (
        <EmptyState title="No apps yet" description="Add your first app to get started.">
          <Button size="sm" onClick={openCreate}>
            Add app
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.category?.id ?? "uncategorised"} className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground/70">
                {group.category?.name ?? "Uncategorised"}
              </h2>
              {group.apps.length === 0 ? (
                <p className="text-sm text-foreground/50">No apps in this category.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.apps.map((app, i) => (
                    <AppCard
                      key={app.id}
                      app={app}
                      isFirst={i === 0}
                      isLast={i === group.apps.length - 1}
                      onEdit={openEdit}
                      onMove={moveApp}
                      onMutate={reload}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {form.open ? (
        <AppForm
          editingId={form.editingId}
          initial={form.initial}
          categories={categories}
          onClose={() => setForm(CLOSED)}
          onSaved={reload}
        />
      ) : null}
    </div>
  );
}
