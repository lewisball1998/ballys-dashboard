"use client";

import { useState } from "react";
import type { CategoryDTO } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createCategory,
  deleteCategory,
  reorderCategories,
  updateCategory,
} from "@/hooks/launcher-api";

interface CategoryManagerProps {
  categories: CategoryDTO[];
  onChanged: () => void;
}

function CategoryRow({
  category,
  isFirst,
  isLast,
  onChanged,
  onMove,
}: {
  category: CategoryDTO;
  isFirst: boolean;
  isLast: boolean;
  onChanged: () => void;
  onMove: (id: number, direction: "up" | "down") => void;
}) {
  const [name, setName] = useState(category.name);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
      <Button
        variant="outline"
        size="sm"
        disabled={busy || name.trim() === "" || name === category.name}
        onClick={() => run(() => updateCategory(category.id, { name: name.trim() }))}
      >
        Rename
      </Button>
      <Button variant="ghost" size="sm" disabled={busy || isFirst} aria-label="Move up" onClick={() => onMove(category.id, "up")}>
        ↑
      </Button>
      <Button variant="ghost" size="sm" disabled={busy || isLast} aria-label="Move down" onClick={() => onMove(category.id, "down")}>
        ↓
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => {
          if (confirm(`Delete category "${category.name}"? Its apps become uncategorised.`)) {
            run(() => deleteCategory(category.id));
          }
        }}
      >
        Delete
      </Button>
    </div>
  );
}

export function CategoryManager({ categories, onChanged }: CategoryManagerProps) {
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const ordered = [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

  const add = async () => {
    if (newName.trim() === "") return;
    setBusy(true);
    try {
      await createCategory({ name: newName.trim() });
      setNewName("");
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const move = async (id: number, direction: "up" | "down") => {
    const ids = ordered.map((c) => c.id);
    const index = ids.indexOf(id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    await reorderCategories(ids);
    onChanged();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage categories</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name"
            className="h-8"
          />
          <Button size="sm" disabled={busy || newName.trim() === ""} onClick={add}>
            Add
          </Button>
        </div>
        {ordered.length === 0 ? (
          <p className="text-sm text-foreground/60">No categories yet.</p>
        ) : (
          <div className="space-y-2">
            {ordered.map((c, i) => (
              <CategoryRow
                key={c.id}
                category={c}
                isFirst={i === 0}
                isLast={i === ordered.length - 1}
                onChanged={onChanged}
                onMove={move}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
