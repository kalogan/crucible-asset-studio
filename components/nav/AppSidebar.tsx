"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavActive } from "@/lib/nav-items";

/** The desktop left sidebar (md+). On mobile the AppNav top bar is shown instead. */
export function AppSidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-52 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-background/95 px-3 py-4 backdrop-blur md:flex">
      <Link
        href="/"
        className="mb-3 px-3 font-serif text-lg font-semibold tracking-wide text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Crucible
      </Link>
      <nav aria-label="Primary" className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
