"use client";

import { useState } from "react";
import Link from "next/link";
import type { Project } from "@/lib/schema";
import { timeAgo } from "@/lib/util/time";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type KindFilter = "all" | "game" | "app";

/** Default Type label when the project has no explicit `type` set. */
function typeLabel(p: Project): string {
  return p.type?.trim() || (p.kind === "app" ? "Web App" : "Game");
}

export function GamesGrid({
  projects,
  repoUpdated = {},
  derivedTags = {},
}: {
  projects: Project[];
  /** projectId → GitHub repo pushed_at (ISO). */
  repoUpdated?: Record<string, string>;
  /** projectId → tech/genres auto-derived from the GitHub repo (used when not set manually). */
  derivedTags?: Record<string, { tech: string[]; genres: string[] }>;
}) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const query = q.trim().toLowerCase();
  const filtered = projects.filter((p) => {
    if (kind !== "all" && p.kind !== kind) return false;
    if (!query) return true;
    return (
      p.name.toLowerCase().includes(query) ||
      (p.description ?? "").toLowerCase().includes(query) ||
      p.slug.includes(query)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="game-search" className="sr-only">
          Search projects
        </label>
        <Input
          id="game-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search projects…"
          className="flex-1"
        />
        <div className="flex gap-1 rounded-md border border-border p-1">
          {(["all", "game", "app"] as KindFilter[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {k === "all" ? "All" : `${k}s`}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground" role="status">
          {projects.length === 0 ? "No projects yet." : "Nothing matches your filter."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1700px]:grid-cols-6">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="flex flex-col overflow-hidden rounded-lg border border-border bg-card"
            >
              <Link
                href={`/projects/${p.slug}`}
                className="group flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-muted">
                  {p.screenshot ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.screenshot}
                      alt={`${p.name} screenshot`}
                      style={{
                        objectPosition: `${p.screenshot_focal_x * 100}% ${p.screenshot_focal_y * 100}%`,
                      }}
                      className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                      No screenshot
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 p-4">
                  <h2 className="font-serif text-lg font-semibold text-foreground group-hover:text-primary">
                    {p.name}
                  </h2>
                  <div className="flex flex-wrap gap-1">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {typeLabel(p)}
                    </span>
                    {(p.tech.length ? p.tech : derivedTags[p.id]?.tech ?? []).map((t) => (
                      <span
                        key={`tech-${t}`}
                        className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                    {(p.genres.length ? p.genres : derivedTags[p.id]?.genres ?? []).map((g) => (
                      <span
                        key={`genre-${g}`}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const when = timeAgo(repoUpdated[p.id] ?? "");
                      return when ? `Updated ${when}` : p.repo_url ? "—" : "No repo linked";
                    })()}
                  </p>
                </div>
              </Link>
              <div className="px-4 pb-4">
                {p.url ? (
                  <Button asChild className="w-full">
                    <a href={p.url} target="_blank" rel="noreferrer">
                      {p.kind === "app" ? "Open" : "Play"} ↗
                    </a>
                  </Button>
                ) : (
                  <Button variant="outline" disabled className="w-full">
                    No live URL
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
