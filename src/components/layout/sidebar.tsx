"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/theme-provider";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/apps", label: "Apps" },
  { href: "/docker", label: "Docker" },
  { href: "/infrastructure", label: "Infrastructure" },
  { href: "/notifications", label: "Notifications" },
  { href: "/settings", label: "Settings" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  const { dashboardName } = useTheme();

  return (
    <aside className="flex flex-col gap-3 border-b border-border bg-surface/70 p-3 md:min-h-screen md:gap-6 md:border-b-0 md:border-r md:p-4">
      <div className="flex items-center gap-2 px-1 md:px-2">
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent text-[11px] font-bold text-accent-foreground"
          aria-hidden
        >
          {dashboardName.charAt(0).toUpperCase()}
        </span>
        <span className="truncate text-sm font-semibold tracking-tight">{dashboardName}</span>
      </div>

      <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-accent/10 font-medium text-accent"
                  : "text-muted hover:bg-foreground/[0.06] hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
