"use client";

import { useCallback, useEffect, useState } from "react";
import type { CategoryDTO, DockerImportCandidatesResponseDTO } from "@/lib/types";
import { fetchCategories } from "./launcher-api";
import { fetchImportCandidates } from "./docker-import-api";

interface UseDockerImportResult {
  data: DockerImportCandidatesResponseDTO | null;
  categories: CategoryDTO[];
  loading: boolean;
  /** Transport-level error (Docker being unavailable is NOT an error — it comes
   * back inside `data.availability`). */
  error: string | null;
  refresh: () => Promise<void>;
}

/** Loads import candidates + categories for the Import-from-Docker flow. */
export function useDockerImport(): UseDockerImportResult {
  const [data, setData] = useState<DockerImportCandidatesResponseDTO | null>(null);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [candidates, cats] = await Promise.all([fetchImportCandidates(), fetchCategories()]);
    if (candidates.ok) {
      setData(candidates.data);
      setError(null);
    } else {
      setError(candidates.error.message);
    }
    if (cats.ok) setCategories(cats.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, categories, loading, error, refresh };
}
