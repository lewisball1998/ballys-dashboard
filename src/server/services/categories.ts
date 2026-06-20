import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import type { Category } from "@/db/schema";
import type { CategoryDTO } from "@/lib/types";
import type { CategoryCreateInput, CategoryUpdateInput } from "@/lib/validation";

function toDTO(row: Category): CategoryDTO {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon ?? null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function nextSortOrder(): number {
  const row = db.select({ max: sql<number | null>`max(${categories.sortOrder})` }).from(categories).get();
  return (row?.max ?? -1) + 1;
}

export function listCategories(): CategoryDTO[] {
  return db
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.id))
    .all()
    .map(toDTO);
}

export function createCategory(input: CategoryCreateInput): CategoryDTO {
  const now = new Date();
  const row = db
    .insert(categories)
    .values({
      name: input.name,
      icon: input.icon ?? null,
      sortOrder: input.sortOrder ?? nextSortOrder(),
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  return toDTO(row);
}

export function updateCategory(id: number, input: CategoryUpdateInput): CategoryDTO | null {
  const set: Partial<Pick<Category, "name" | "icon" | "sortOrder">> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) set.name = input.name;
  if (input.icon !== undefined) set.icon = input.icon ?? null;
  if (input.sortOrder !== undefined) set.sortOrder = input.sortOrder;

  const row = db.update(categories).set(set).where(eq(categories.id, id)).returning().get();
  return row ? toDTO(row) : null;
}

export function deleteCategory(id: number): boolean {
  // Apps in this category have categoryId set to null via the FK onDelete rule.
  return db.delete(categories).where(eq(categories.id, id)).run().changes > 0;
}

export function reorderCategories(ids: number[]): CategoryDTO[] {
  const now = new Date();
  db.transaction((tx) => {
    ids.forEach((id, index) => {
      tx.update(categories).set({ sortOrder: index, updatedAt: now }).where(eq(categories.id, id)).run();
    });
  });
  return listCategories();
}
