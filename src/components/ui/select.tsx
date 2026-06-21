import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "text-foreground border-border h-10 w-full rounded-md border bg-transparent px-3 text-sm",
        "transition-colors outline-none",
        // Make the native dropdown render in the active theme: `color-scheme`
        // drives the UA popup palette (so dark mode no longer shows a white list),
        // and the option colours are themed where the browser honours them.
        "[color-scheme:light] dark:[color-scheme:dark]",
        "[&>option]:bg-surface [&>option]:text-foreground",
        "focus-visible:border-accent focus-visible:ring-accent/40 focus-visible:ring-2",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
