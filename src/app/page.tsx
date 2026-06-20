import { APP_VERSION } from "@/lib/constants";

/**
 * Phase 0 scaffold landing page. Intentionally minimal — it only confirms the
 * stack boots and Tailwind is wired. The real dashboard shell is built by the
 * Frontend agent in Phase 1; this file will be replaced.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Bally&apos;s Dashboard</h1>
        <p className="text-sm opacity-70">Homelab infrastructure command centre</p>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-foreground/5 px-5 py-4 text-sm">
        <p className="font-medium text-accent">Phase 0 scaffold is running.</p>
        <p className="mt-1 opacity-70">
          Engines wired: module registry · scheduler · event pipeline · guarded fetch · SQLite.
        </p>
      </div>

      <p className="text-xs opacity-50">
        v{APP_VERSION} ·{" "}
        <a className="underline hover:text-accent" href="/api/health">
          /api/health
        </a>
      </p>
    </main>
  );
}
