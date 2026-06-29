import type { ProjectStatus } from "@/lib/schema";

/** Badge classes per portfolio status (not color-only — the label text carries meaning). */
export function statusBadgeClass(status: ProjectStatus): string {
  switch (status) {
    case "shipped":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "active":
      return "border-amber-500/40 bg-amber-500/10 text-amber-300";
    case "paused":
      return "border-zinc-600 bg-zinc-800 text-zinc-400";
    case "prototype":
    default:
      return "border-sky-500/40 bg-sky-500/10 text-sky-300";
  }
}
