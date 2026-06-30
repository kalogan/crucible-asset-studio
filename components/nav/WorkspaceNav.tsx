"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type SwitchItem = { slug: string; name: string; kind: "game" | "app" };

const GAME_TABS = [
  { seg: "", label: "Overview" },
  { seg: "/generate", label: "Generate" },
  { seg: "/review", label: "Review" },
  { seg: "/canon", label: "Canon" },
  { seg: "/library", label: "Library" },
  { seg: "/prompts", label: "Prompts" },
  { seg: "/batch", label: "Batches" },
];
const APP_TABS = [{ seg: "", label: "Overview" }];

const tab =
  "inline-flex min-h-9 items-center rounded-md px-3 text-sm font-medium transition-colors";
const tabActive = "bg-primary text-primary-foreground";
const tabInactive = "text-muted-foreground hover:bg-muted hover:text-foreground";

/**
 * The per-project nav, nested under /projects/[slug]. Breadcrumb + a switcher to jump
 * between projects + the project's tabs (full asset-gen set for games, Overview-only
 * for apps). These tabs are deliberately NOT in the global top nav.
 */
export function WorkspaceNav({
  slug,
  name,
  kind,
  projects,
}: {
  slug: string;
  name: string | null;
  kind: "game" | "app";
  projects: SwitchItem[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/projects/${slug}`;
  const tabs = kind === "app" ? APP_TABS : GAME_TABS;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 pt-6 lg:max-w-5xl xl:max-w-6xl min-[1440px]:max-w-7xl">
      <div className="mb-4 flex flex-col gap-3 border-b border-border pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Link href="/" className="hover:text-foreground">
              Crucible
            </Link>
            <span aria-hidden>/</span>
            <span className="text-foreground">{name ?? slug}</span>
            <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
              {kind}
            </span>
          </nav>

          {projects.length > 1 && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Switch
              <select
                value={slug}
                onChange={(e) => router.push(`/projects/${e.target.value}`)}
                className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
              >
                {projects.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                    {p.kind === "app" ? " (app)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <ul className="flex flex-wrap gap-1">
          {tabs.map((t) => {
            const href = `${base}${t.seg}`;
            const isActive = pathname === href;
            return (
              <li key={t.label}>
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={`${tab} ${isActive ? tabActive : tabInactive}`}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
