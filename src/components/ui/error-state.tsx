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
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-6 text-center",
        className,
      )}
      role="alert"
    >
      <p className="text-sm text-rose-600 dark:text-rose-400">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
