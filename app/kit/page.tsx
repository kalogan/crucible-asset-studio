import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CoverageSummary } from "@/components/kit/CoverageSummary";
import { AdoptionMatrix } from "@/components/kit/AdoptionMatrix";
import { OpportunitiesPanel } from "@/components/kit/OpportunitiesPanel";

export const dynamic = "force-dynamic";

export default function KitPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-12 lg:max-w-5xl xl:max-w-6xl min-[1440px]:max-w-7xl">
      <header className="flex flex-col gap-2">
        <Link href="/" className="w-fit text-sm text-primary underline underline-offset-2">
          ← Games
        </Link>
        <h1 className="text-3xl font-semibold">Kit health check</h1>
        <p className="text-sm text-muted-foreground">
          Which reusable game-kit systems land across the games, where the gaps and
          opportunities are, and where to expand next. Seeded from the systems audit in{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">lib/kit/catalog.ts</code> —
          director-editable estimates, not computed from the codebases.
        </p>
        <Button asChild className="mt-2 w-fit">
          <Link href="/kit/scaffold">Scaffold a game →</Link>
        </Button>
      </header>

      <CoverageSummary />
      <AdoptionMatrix />
      <OpportunitiesPanel />
    </main>
  );
}
