import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-foreground/15 bg-transparent px-3 text-sm",
        "outline-none focus:border-accent focus:ring-1 focus:ring-accent",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
