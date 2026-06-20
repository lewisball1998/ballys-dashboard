import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface-2/30 px-6 py-8 text-center",
        className,
      )}
      role="alert"
    >
      <span className="flex items-center gap-2 text-sm text-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden />
        {message}
      </span>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
