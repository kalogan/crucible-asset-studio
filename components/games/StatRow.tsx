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
  const playable = projects.filter((p) => p.url).length;
  return {
    games: projects.length,
    byStatus,
    totalAssets,
    playable,
  };
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-card px-4 py-3">
      <span className="text-2xl font-semibold tabular-nums text-foreground">{value}</span>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function StatRow({
  stats,
}: {
  stats: ReturnType<typeof computeStats>;
}) {
  const { byStatus } = stats;
  const statusHint = `${byStatus.active} active · ${byStatus.shipped} shipped · ${byStatus.prototype} proto · ${byStatus.paused} paused`;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Games" value={stats.games} hint={statusHint} />
      <Stat label="Assets generated" value={stats.totalAssets} />
      <Stat label="Playable" value={stats.playable} hint="have a play URL" />
      <Stat label="Shipped" value={byStatus.shipped} hint="status: shipped" />
    </div>
  );
}
