"use client";

import { useState } from "react";
import { resolveIconSrc } from "@/lib/icons/resolve";
import { cn } from "@/lib/utils";

/**
 * Shared app-icon renderer (v0.2.6). One icon path for the launcher card, Quick
 * Launch and individual app widgets. Resolves the `apps.icon` reference string:
 *   - URL / custom upload → <img> (with graceful onError → initials)
 *   - built-in monochrome glyph → CSS mask in currentColor (theme-adaptive)
 *   - none / unknown → initials fallback
 *
 * `className` controls the box size (e.g. "h-9 w-9 text-sm"); the text size is
 * used by the initials fallback.
 */
export function AppIcon({
  icon,
  name,
  className,
}: {
  icon: string | null | undefined;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const resolved = failed ? ({ mode: "initials" } as const) : resolveIconSrc(icon ?? null);
  const box = cn("shrink-0 rounded-md", className);

  if (resolved.mode === "img") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user icon URL / opaque custom-icon endpoint; next/image would require remote config
      <img
        src={resolved.src}
        alt=""
        className={cn(box, "object-cover")}
        onError={() => setFailed(true)}
      />
    );
  }

  if (resolved.mode === "mask") {
    return (
      <span
        aria-hidden
        className={cn(box, "text-foreground/80 bg-current")}
        style={{
          WebkitMaskImage: `url(${resolved.src})`,
          maskImage: `url(${resolved.src})`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "72%",
          maskSize: "72%",
        }}
      />
    );
  }

  return (
    <span
      className={cn(
        box,
        "bg-foreground/10 text-foreground/80 flex items-center justify-center font-semibold",
      )}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}
