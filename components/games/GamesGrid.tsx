"use client";

import { useState } from "react";
import Link from "next/link";
import type { Project } from "@/lib/schema";
import { statusBadgeClass } from "@/lib/projects/status";
import { Input } from "@/components/ui/input";

export function GamesGrid({ projects }: { projects: Project[] }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const filtered = query
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.description ?? "").toLowerCase().includes(query) ||
          p.slug.includes(query),
      )
    : projects;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="game-search" className="sr-only">
          Search games
        </label>
        <Input
          id="game-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search games…"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground" role="status">
          {projects.length === 0 ? "No games yet." : `No games match “${q}”.`}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="flex flex-col overflow-hidden rounded-lg border border-border bg-card"
            >
              <Link
                href={`/projects/${p.slug}`}
                className="group flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="aspect-video w-full overflow-hidden bg-muted">
                  {p.screenshot ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.screenshot}
                      alt={`${p.name} screenshot`}
                      className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                      No screenshot
                    </div>
                  )}
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
