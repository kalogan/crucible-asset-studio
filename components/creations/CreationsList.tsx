"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Project } from "@/lib/schema";
import { statusBadgeClass } from "@/lib/projects/status";
import { timeAgo } from "@/lib/util/time";
import { compareByName, compareByPushedAt } from "@/lib/library/projects";

type SortKey = "updated" | "name";

/**
 * Client wrapper for the Creations list: takes the server-loaded projects and renders a
 * labeled sort control over them (no new fetches). Default is "Last updated" (the same
 * github_pushed_at ordering the dashboard uses); "Name" is A–Z.
 */
export function CreationsList({ projects }: { projects: Project[] }) {
  const [sort, setSort] = useState<SortKey>("updated");

  const sorted = useMemo(() => {
    const cmp = sort === "name" ? compareByName : compareByPushedAt;
    return [...projects].sort(cmp);
  }, [projects, sort]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <label htmlFor="creations-sort" className="text-xs font-medium text-muted-foreground">
          Sort by
        </label>
        <select
          id="creations-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="updated">Last updated</option>
          <option value="name">Name (A–Z)</option>
        </select>
      </div>

      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
        {sorted.map((p) => (
          <li key={p.id} className="flex items-center gap-5 p-4">
            <Link
              href={`/projects/${p.slug}`}
              className="group flex min-w-0 flex-1 items-center gap-5 focus-visible:outline-none"
            >
              <div className="aspect-video h-24 shrink-0 overflow-hidden rounded-md bg-muted sm:h-28">
                {p.screenshot && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.screenshot}
                    alt=""
                    style={{
                      objectPosition: `${p.screenshot_focal_x * 100}% ${p.screenshot_focal_y * 100}%`,
                    }}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-base font-semibold text-foreground group-hover:text-primary">
                    {p.name}
                  </span>
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {p.kind}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(p.status)}`}
                  >
                    {p.status}
                  </span>
                </div>
                {(p.summary || p.description) && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {p.summary || p.description}
                  </p>
                )}
                <span className="text-xs text-muted-foreground">
                  {p.github_pushed_at
                    ? `Updated ${timeAgo(p.github_pushed_at)}`
                    : p.repo_url
                      ? "Updated —"
                      : "No repo linked"}
                </span>
              </div>
            </Link>
            <div className="flex shrink-0 items-center gap-3 text-sm">
              {p.url && (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  {p.kind === "app" ? "Open" : "Play"} ↗
                </a>
              )}
              {p.repo_url && (
                <a
                  href={p.repo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Repo ↗
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
