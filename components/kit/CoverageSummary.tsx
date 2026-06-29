import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GAMES, SYSTEMS } from "@/lib/kit/catalog";
import { coverageSummary, builtSystemGapsByGame } from "@/lib/kit/derive";

function Stat({
  value,
  label,
  hint,
}: {
  value: number;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/40 p-4">
      <span className="font-serif text-3xl font-semibold tabular-nums text-foreground">
        {value}
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  );
}

export function CoverageSummary() {
  const summary = coverageSummary(SYSTEMS, GAMES);
  const bars = builtSystemGapsByGame(SYSTEMS, GAMES);
  const maxGaps = bars.reduce((m, b) => Math.max(m, b.gaps), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coverage summary</CardTitle>
        <p className="text-sm text-muted-foreground">
          Built vs planned systems, plus where each could land across the games.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            value={summary.builtCount}
            label="Systems built"
            hint="shipping in the kit"
          />
          <Stat
            value={summary.plannedCount}
            label="Systems planned"
            hint="not yet built"
          />
          <Stat
            value={summary.unifyOpportunities}
            label="Could unify here"
            hint="games hand-rolling a built system"
          />
          <Stat
            value={summary.expandOpportunities}
            label="Could add here"
            hint="net-new adoption for a built system"
          />
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-foreground">
            Built systems each game could adopt
          </h3>
          <ul className="flex flex-col gap-2.5">
            {bars.map(({ game, gaps, builtTotal }) => {
              const pct = maxGaps > 0 ? (gaps / maxGaps) * 100 : 0;
              return (
                <li key={game.id} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-sm text-foreground">
                    {game.name}
                  </span>
                  <div
                    className="relative h-3 flex-1 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`${game.name}: ${gaps} of ${builtTotal} built systems available to adopt`}
                  >
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-primary/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {gaps} gap{gaps === 1 ? "" : "s"}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            Bars show <Badge variant="primary">opportunity</Badge> cells — built
            systems a game doesn&apos;t have yet.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
