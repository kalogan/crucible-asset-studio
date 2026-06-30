"use client";

import { useState } from "react";
import Link from "next/link";
import type { Project } from "@/lib/schema";
import { statusBadgeClass } from "@/lib/projects/status";
import { Input } from "@/components/ui/input";

type KindFilter = "all" | "game" | "app";

export function GamesGrid({
  projects,
  assetCounts = {},
}: {
  projects: Project[];
  assetCounts?: Record<string, number>;
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
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                  <span className="absolute left-2 top-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur">
                    {p.kind}
                  </span>
                </div>
                <div className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-serif text-lg font-semibold text-foreground group-hover:text-primary">
                      {p.name}
                    </h2>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(p.status)}`}
                    >
                      {p.status}
                    </span>
                  </div>
                  {p.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                  )}
                  {p.kind === "game" && (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {assetCounts[p.id] ?? 0} asset{(assetCounts[p.id] ?? 0) === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </Link>
              {p.url && (
                <div className="px-4 pb-4">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Play ↗
                  </a>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
