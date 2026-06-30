import type { Project, ProjectStatus } from "@/lib/schema";

/** Compute the dashboard's headline stats from projects + per-project asset counts. */
export function computeStats(projects: Project[], assetCounts: Record<string, number>) {
  const byStatus: Record<ProjectStatus, number> = {
    prototype: 0,
    active: 0,
    shipped: 0,
    paused: 0,
  };
  for (const p of projects) byStatus[p.status] += 1;
  const totalAssets = Object.values(assetCounts).reduce((a, b) => a + b, 0);
  // Commits = total across repos (stored per-project by refresh-github, read from the DB).
  const commits = projects.reduce((sum, p) => sum + (p.commit_count ?? 0), 0);
  const games = projects.filter((p) => p.kind === "game").length;
  const apps = projects.filter((p) => p.kind === "app").length;
  return {
    total: projects.length,
    games,
    apps,
    byStatus,
    totalAssets,
    commits,
  };
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-card px-4 py-3">
      <span className="text-2xl font-semibold tabular-nums text-foreground">{value}</span>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

export function StatRow({
  stats,
}: {
  stats: ReturnType<typeof computeStats>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Games" value={stats.games} />
      <Stat label="Apps" value={stats.apps} />
      <Stat label="Commits" value={stats.commits} />
      <Stat label="Assets" value={stats.totalAssets} />
    </div>
  );
}
