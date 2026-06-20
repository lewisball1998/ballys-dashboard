import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({ title, description, className, children }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/15 p-8 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="max-w-sm text-sm text-foreground/60">{description}</p> : null}
      {children}
    </div>
  );
}
