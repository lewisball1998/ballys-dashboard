import { cn } from "@/lib/utils";

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label = "Loading…", className }: LoadingStateProps) {
  return (
    <div
      className={cn("flex items-center justify-center gap-2 p-6 text-sm text-muted", className)}
      role="status"
      aria-live="polite"
    >
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-foreground/20 border-t-accent"
        aria-hidden
      />
      {label}
    </div>
  );
}
