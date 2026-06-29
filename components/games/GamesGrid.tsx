"use client";

import { useState } from "react";
import Link from "next/link";
import type { Project } from "@/lib/schema";
import { statusBadgeClass } from "@/lib/projects/status";

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
      <div className="flex flex-col gap-1.5">
        <label htmlFor="game-search" className="sr-only">
          Search games
        </label>
        <input
          id="game-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search games…"
          className="min-h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-zinc-100 placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-400" role="status">
          {projects.length === 0 ? "No games yet." : `No games match “${q}”.`}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50"
            >
              <Link
                href={`/projects/${p.slug}`}
                className="group flex flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                <div className="aspect-video w-full overflow-hidden bg-zinc-900">
                  {p.screenshot ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.screenshot}
                      alt={`${p.name} screenshot`}
                      className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-zinc-600">
                      No screenshot
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold text-zinc-50 group-hover:text-amber-200">
                      {p.name}
                    </h2>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(p.status)}`}
                    >
                      {p.status}
                    </span>
                  </div>
                  {p.description && (
                    <p className="line-clamp-2 text-sm text-zinc-400">{p.description}</p>
                  )}
                </div>
              </Link>
              {p.url && (
                <div className="px-4 pb-4">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded text-sm text-amber-300 underline underline-offset-2 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
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
