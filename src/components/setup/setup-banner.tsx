"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchSetupStatus } from "@/hooks/setup-api";
import { needsSetup } from "./setup-logic";

/**
 * Lightweight first-run prompt: if setup is not complete, encourage the user to
 * open the wizard. Non-blocking (dismissible) so a skipped setup still leaves the
 * dashboard fully usable. No redirect, no middleware (v0.1 gate).
 */
export function SetupBanner() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    void fetchSetupStatus().then((res) => {
      if (res.ok) setShow(needsSetup(res.data));
    });
  }, []);

  if (!show || dismissed) return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-accent/40 bg-accent/10 px-4 py-2 text-sm">
      <span>Finish setting up your dashboard to get started.</span>
      <span className="flex items-center gap-3">
        <Link href="/setup" className="font-medium text-accent hover:underline">
          Open setup
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-muted hover:text-foreground"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </span>
    </div>
  );
}
