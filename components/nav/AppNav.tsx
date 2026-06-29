"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

const ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/generate", label: "Generate" },
  { href: "/review", label: "Review" },
  { href: "/canon", label: "Canon" },
  { href: "/prompts", label: "Prompts" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const linkBase =
  "inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium " +
  "transition-colors focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-amber-400";
const linkActive = "border-amber-400 text-amber-300";
const linkInactive =
  "border-transparent text-zinc-400 hover:text-zinc-100 hover:border-zinc-700";

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4">
        <Link
          href="/"
          className="mr-1 inline-flex min-h-11 items-center text-sm font-semibold uppercase tracking-widest text-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
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
