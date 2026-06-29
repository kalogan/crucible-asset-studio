import Link from "next/link";
import { SYSTEMS, type KitSystem, type Tier } from "@/lib/kit/catalog";
import { Scaffolder, type ScaffoldSystem } from "@/components/kit/Scaffolder";

export const dynamic = "force-dynamic";

const TIER_ORDER: readonly Tier[] = ["atom", "system", "kit"];

/** Built systems, grouped by tier in a fixed order, passed to the client form. */
function builtByTier(): ScaffoldSystem[] {
  const built: KitSystem[] = SYSTEMS.filter((s) => s.status === "built");
  return [...built].sort((a, b) => {
    const ta = TIER_ORDER.indexOf(a.tier);
    const tb = TIER_ORDER.indexOf(b.tier);
    if (ta !== tb) return ta - tb;
    return a.name.localeCompare(b.name);
  }).map((s) => ({ id: s.id, name: s.name, tier: s.tier }));
}

export default function ScaffoldPage() {
  const systems = builtByTier();

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-12 lg:max-w-5xl xl:max-w-6xl min-[1440px]:max-w-7xl">
      <header className="flex flex-col gap-2">
        <Link
          href="/kit"
          className="w-fit text-sm text-primary underline underline-offset-2"
        >
          ← Kit health check
        </Link>
        <h1 className="text-3xl font-semibold">Scaffold a game</h1>
        <p className="text-sm text-muted-foreground">
          Pick kit pieces + a starter target, then generate a runnable Vite
          project wired to{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">game-kit</code>.
          Each picked system imports + initializes its piece in the generated
          entry file — a compiling skeleton you fill in. Copy individual files or
          download the whole thing as a <code className="rounded bg-muted px-1 py-0.5 text-xs">.zip</code>.
        </p>
      </header>

      <Scaffolder systems={systems} />
    </main>
  );
}
