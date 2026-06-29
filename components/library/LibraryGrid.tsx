"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export interface LibraryItem {
  id: string;
  label: string;
  type: string;
  source: "procgen" | "generated";
  imageUrl: string | null;
}

export function LibraryGrid({ items }: { items: LibraryItem[] }) {
  const types = Array.from(new Set(items.map((i) => i.type))).sort();
  const [filter, setFilter] = useState<string>("all");
  const shown = filter === "all" ? items : items.filter((i) => i.type === filter);

  const chip = (key: string, label: string) =>
    `min-h-9 rounded-full border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      filter === key
        ? "border-primary bg-primary/10 text-primary"
        : "border-border text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by type">
        <button type="button" onClick={() => setFilter("all")} className={chip("all", "All")}>
          All ({items.length})
        </button>
        {types.map((t) => (
          <button key={t} type="button" onClick={() => setFilter(t)} className={chip(t, t)}>
            {t}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground" role="status">
          Nothing here yet.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {shown.map((i) => (
            <li
              key={`${i.source}-${i.id}`}
              className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2"
            >
              <div className="aspect-square overflow-hidden rounded-md bg-muted">
                {i.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.imageUrl} alt={i.label} className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    no image
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-xs text-foreground" title={i.label}>
                  {i.label}
                </span>
                <Badge variant={i.source === "generated" ? "primary" : "accent"}>
                  {i.source === "generated" ? "gen" : "proc"}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
