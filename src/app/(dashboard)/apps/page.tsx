import { EmptyState } from "@/components/ui/empty-state";

export default function AppsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Apps</h1>
        <p className="text-sm text-foreground/60">Your application launcher.</p>
      </header>
      <EmptyState
        title="App launcher coming in Phase 2"
        description="Categories, apps, icons, favourites and health checks will live here."
      />
    </div>
  );
}
