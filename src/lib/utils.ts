/**
 * Tiny class-name combiner. Kept dependency-free in Phase 0; the Frontend agent
 * may swap this for clsx + tailwind-merge in Phase 1 if needed.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
