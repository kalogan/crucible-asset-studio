"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

const ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/generate", label: "Generate" },
  { href: "/review", label: "Review" },
  { href: "/canon", label: "Canon" },
  { href: "/library", label: "Library" },
  { href: "/editor", label: "Editor" },
  { href: "/systems", label: "Systems" },
  { href: "/prompts", label: "Prompts" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const linkBase =
  "inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium " +
  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const linkActive = "border-primary text-primary";
const linkInactive =
  "border-transparent text-muted-foreground hover:text-foreground hover:border-border";

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="border-b border-border bg-background/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 xl:max-w-6xl min-[1440px]:max-w-7xl">
        <Link
          href="/"
          className="mr-1 inline-flex min-h-11 items-center font-serif text-base font-semibold tracking-wide text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Crucible
        </Link>
        <ul className="flex flex-1 items-center gap-1 overflow-x-auto">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`${linkBase} ${active ? linkActive : linkInactive}`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
