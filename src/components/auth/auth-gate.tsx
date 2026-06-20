"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStatus } from "@/hooks/use-auth-status";
import { LoadingState } from "@/components/ui/loading-state";
import { gateDecision } from "./auth-logic";

/**
 * Client-side dashboard gate (no middleware, no DB-in-edge). Blocks rendering of
 * the dashboard until the session is known and allowed; redirects to /login or
 * /setup as needed. When auth is disabled, access is allowed.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useAuthStatus();
  const decision = gateDecision(status);

  useEffect(() => {
    if (decision === "login") router.replace("/login");
    else if (decision === "setup") router.replace("/setup");
  }, [decision, router]);

  if (decision === "allow") return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingState label={decision === "loading" ? "Loading…" : "Redirecting…"} />
    </div>
  );
}
