import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GAMES, SYSTEMS } from "@/lib/kit/catalog";
import {
  buildNext,
  adoptHere,
  expandTo,
  type Opportunity,
} from "@/lib/kit/derive";

const TOP_N = 5;

function OpportunityList({
  title,
  blurb,
  unit,
  items,
}: {
  title: string;
  blurb: string;
  /** Noun describing what `count` represents, e.g. "games". */
  unit: string;
  items: Opportunity[];
}) {
  const top = items.slice(0, TOP_N);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{blurb}</p>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing ranked here.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {top.map((o, i) => (
              <li key={o.system.id} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    <span className="mr-1.5 text-xs tabular-nums text-muted-foreground">
                      {i + 1}.
                    </span>
                    {o.system.name}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {o.system.tier}
                    </span>
                  </span>
                  <Badge variant="outline" className="shrink-0 tabular-nums">
                    {o.count} {unit}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {o.games.map((g) => g.name).join(", ")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export function OpportunitiesPanel() {
  const next = buildNext(SYSTEMS, GAMES);
  const adopt = adoptHere(SYSTEMS, GAMES);
  const expand = expandTo(SYSTEMS, GAMES);

  return (
    <section className="flex flex-col gap-4" aria-labelledby="kit-opportunities">
      <h2 id="kit-opportunities" className="font-serif text-lg font-semibold">
        Opportunities
      </h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <OpportunityList
          title="Build next"
          blurb="Planned systems most games already hand-roll — highest leverage to build."
          unit="games"
          items={next}
        />
        <OpportunityList
          title="Adopt here"
          blurb="Built systems games still hand-roll their own impl of — unify onto the kit."
          unit="own impls"
          items={adopt}
        />
        <OpportunityList
          title="Expand to"
          blurb="Built systems with games that could pick them up net-new."
          unit="gaps"
          items={expand}
        />
      </div>
    </section>
  );
}
