import Link from "next/link";
import {
  SYSTEMS,
  SYSTEM_DESCRIPTIONS,
  APP_SYSTEMS,
  APP_SYSTEM_DESCRIPTIONS,
  type KitSystem,
  type Tier,
} from "@/lib/kit/catalog";
import { Scaffolder, type ScaffoldSystem } from "@/components/kit/Scaffolder";

export const dynamic = "force-dynamic";

const TIER_ORDER: readonly Tier[] = ["atom", "system", "kit"];

/**
 * Built systems from both kit families (game-kit + app-kit), grouped by tier in a
 * fixed order, passed to the client form. Each carries its `kind` so the scaffolder's
 * family selector can filter the catalog; descriptions come from the matching table.
 */
function builtByTier(): ScaffoldSystem[] {
  const built: KitSystem[] = [...SYSTEMS, ...APP_SYSTEMS].filter(
    (s) => s.status === "built",
  );
  return [...built].sort((a, b) => {
    const ta = TIER_ORDER.indexOf(a.tier);
    const tb = TIER_ORDER.indexOf(b.tier);
    if (ta !== tb) return ta - tb;
    return a.name.localeCompare(b.name);
  }).map((s) => {
    const kind = s.kind ?? "game";
    return {
      id: s.id,
      name: s.name,
      tier: s.tier,
      kind,
      description:
        (kind === "app" ? APP_SYSTEM_DESCRIPTIONS : SYSTEM_DESCRIPTIONS)[s.id] ?? "",
    };
  });
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ScaffoldPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const systems = builtByTier();
  const sp = (await searchParams) ?? {};

  // Optional prefill from the design brief (/brief → "Scaffold this →").
  const initialName = firstParam(sp.name);
  const targetParam = firstParam(sp.target);
  const initialTarget = targetParam === "vanilla" || targetParam === "r3f" ? targetParam : undefined;
  const systemsParam = firstParam(sp.systems);
  const initialSystemIds = systemsParam
    ? systemsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[110rem] flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link
          href="/kit"
          className="w-fit text-sm text-primary underline underline-offset-2"
        >
          ← Kit health check
        </Link>
        <h1 className="text-3xl font-semibold">Scaffold a project</h1>
        <p className="text-sm text-muted-foreground">
          Choose a <strong>kit family</strong> — <strong>Game kit</strong>{" "}
          (three.js) or <strong>App kit</strong> (Next.js/React/Supabase) — then
          pick the pieces to wire in. For game-kit, add a template + starter
          target and generate a runnable Vite project wired to{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">game-kit</code>.
          Templates go further than the picker: <strong>Multiplayer</strong>{" "}
          scaffolds a Colyseus server + a client adapter for game-kit&apos;s{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">RoomClient</code>{" "}
          seam; <strong>Procgen World</strong> emits a seeded low-poly world
          generator. Each picked system imports + initializes its piece in the
          generated entry file. Copy individual files or download the whole thing
          as a <code className="rounded bg-muted px-1 py-0.5 text-xs">.zip</code>.
          App-kit pieces are catalogued + browsable now (its runnable starter is
          the next slice).
        </p>
      </header>

      <Scaffolder
        systems={systems}
        {...(initialName ? { initialName } : {})}
        {...(initialTarget ? { initialTarget } : {})}
        {...(initialSystemIds ? { initialSystemIds } : {})}
      />
    </main>
  );
}
