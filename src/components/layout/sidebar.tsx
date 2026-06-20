"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/theme-provider";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/apps", label: "Apps" },
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
    <aside className="flex flex-col gap-6 border-r border-foreground/10 bg-foreground/[0.02] p-4 md:min-h-screen">
      <div className="flex items-center gap-2 px-2">
        <span className="h-6 w-6 rounded-md bg-accent" aria-hidden />
        <span className="truncate text-sm font-semibold">{dashboardName}</span>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition",
                active ? "bg-accent/10 font-medium text-accent" : "text-foreground/70 hover:bg-foreground/5",
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
