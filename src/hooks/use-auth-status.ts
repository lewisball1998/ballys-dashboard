"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthStatusDTO } from "@/lib/types";
import { fetchSession } from "./auth-api";

/** Loads the current auth/session status. */
export function useAuthStatus() {
  const [status, setStatus] = useState<AuthStatusDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetchSession();
    if (res.ok) {
      setStatus(res.data);
      setError(null);
    } else {
      setError(res.error.message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, error, refresh };
}
