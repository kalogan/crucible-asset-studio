import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GAMES,
  SYSTEMS,
  adoptionFor,
  type Adoption,
  type KitSystem,
} from "@/lib/kit/catalog";

function AdoptionCell({ status }: { status: Adoption }) {
  if (status === "core") {
    return (
      <Badge variant="accent" className="font-normal">
        uses own
      </Badge>
    );
  }
  if (status === "gap") {
    return (
      <Badge variant="primary" className="font-normal">
        opportunity
      </Badge>
    );
  }
  return (
    <span className="text-muted-foreground" aria-label="not applicable">
      —
    </span>
  );
}

function SystemRows({
  systems,
  planned,
}: {
  systems: KitSystem[];
  planned: boolean;
}) {
  return (
    <>
      {systems.map((system) => (
        <tr
          key={system.id}
          className={
            planned
              ? "border-t border-border/70 bg-muted/30"
              : "border-t border-border/70"
          }
        >
          <th
            scope="row"
            className="sticky left-0 z-10 bg-card px-3 py-2.5 text-left align-top"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                {system.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {system.tier}
                {system.module ? ` · ${system.module}` : ""}
              </span>
            </div>
          </th>
          {GAMES.map((game) => (
            <td key={game.id} className="px-3 py-2.5 text-center align-middle">
              <AdoptionCell status={adoptionFor(system.id, game.id)} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function AdoptionMatrix() {
  const built = SYSTEMS.filter((s) => s.status === "built");
  const planned = SYSTEMS.filter((s) => s.status === "planned");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adoption matrix</CardTitle>
        <p className="text-sm text-muted-foreground">
          Each kit system against the five games. Built systems first, then
          planned.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Badge variant="accent" className="font-normal">
              uses own
            </Badge>
            game has its own impl (unify)
          </span>
          <span className="flex items-center gap-1.5">
            <Badge variant="primary" className="font-normal">
              opportunity
            </Badge>
            could adopt (net-new)
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="text-muted-foreground">
              —
            </span>
            not applicable
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">
              Kit system adoption across games. Rows are systems (built then
              planned); columns are games. Cells show whether a game already has
              its own implementation, could adopt the system, or is not
              applicable.
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  System
                </th>
                {GAMES.map((game) => (
                  <th
                    key={game.id}
                    scope="col"
                    className="px-3 py-2 text-center text-xs font-semibold text-foreground"
                  >
                    <span className="block">{game.name}</span>
                    <span className="block font-normal text-muted-foreground">
                      {game.engine}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={GAMES.length + 1}
                  className="sticky left-0 bg-background/60 px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-accent"
                >
                  Built · {built.length}
                </th>
              </tr>
              <SystemRows systems={built} planned={false} />
              <tr>
                <th
                  scope="colgroup"
                  colSpan={GAMES.length + 1}
                  className="sticky left-0 bg-background/60 px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-primary"
                >
                  Planned · {planned.length}
                </th>
              </tr>
              <SystemRows systems={planned} planned={true} />
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
