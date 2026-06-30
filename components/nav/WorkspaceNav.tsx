"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/generate", label: "Generate" },
  { href: "/review", label: "Review" },
  { href: "/canon", label: "Canon" },
  { href: "/library", label: "Library" },
  { href: "/prompts", label: "Prompts" },
];

const tab =
  "inline-flex min-h-9 items-center rounded-md px-3 text-sm font-medium transition-colors";
const tabActive = "bg-primary text-primary-foreground";
const tabInactive = "text-muted-foreground hover:bg-muted hover:text-foreground";

/**
 * The per-GAME workspace sub-nav. Shown above the asset-gen pages (generate/review/
 * canon/library/prompts), it makes the active game explicit (breadcrumb) and keeps
 * those game-scoped tabs OUT of the global top nav.
 */
export function WorkspaceNav({
  activeName,
  activeSlug,
}: {
  activeName: string | null;
  activeSlug: string | null;
}) {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-border pb-3">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Crucible
        </Link>
        <span aria-hidden>/</span>
        {activeName && activeSlug ? (
          <Link href={`/projects/${activeSlug}`} className="text-foreground hover:text-primary">
            {activeName}
          </Link>
        ) : (
          <span className="text-destructive">No game selected</span>
        )}
        <span aria-hidden>/</span>
        <span className="text-foreground">Workspace</span>
      </nav>

      {activeName ? (
        <ul className="flex flex-wrap gap-1">
          {TABS.map((t) => {
            const isActive = pathname === t.href;
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`${tab} ${isActive ? tabActive : tabInactive}`}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Pick a game on the{" "}
          <Link href="/" className="text-primary underline underline-offset-2">
            dashboard
          </Link>{" "}
          and open its workspace to start generating.
        </p>
      )}
    </div>
  );
}
