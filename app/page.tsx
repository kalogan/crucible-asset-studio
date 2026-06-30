import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { listProjects } from "@/lib/db/projects";
import { assetCountsByProject } from "@/lib/db/assets";
import { referenceCountsByProject } from "@/lib/db/reference-assets";
import { GamesGrid } from "@/components/games/GamesGrid";
import { StatRow, computeStats } from "@/components/games/StatRow";
import { Button } from "@/components/ui/button";

// Games gallery — the front door. Reads the PORTFOLIO face only.
export const dynamic = "force-dynamic";

function SetupNotice() {
  return (
    <section
      aria-label="Setup required"
      className="rounded-lg border border-primary/40 bg-primary/5 p-5"
    >
      <h2 className="text-lg font-semibold text-primary">Connect Supabase to begin</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Copy <code className="rounded bg-muted px-1.5 py-0.5">.env.example</code> to{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">.env.local</code>, fill in your Supabase
        keys, then run <code className="rounded bg-muted px-1.5 py-0.5">pnpm migrate</code>.
      </p>
    </section>
  );
}

export default async function HomePage() {
  const configured = isSupabaseConfigured();
  // Never let a transient DB/parse error take down the front door — degrade to an
  // empty gallery (the SetupNotice covers the not-configured case).
  let projects: Awaited<ReturnType<typeof listProjects>> = [];
  let assetCounts: Record<string, number> = {};
  let loadFailed = false;
  if (configured) {
    try {
      projects = await listProjects();
      // Newest GitHub activity first; projects with no GitHub date fall to the bottom
      // (tie-broken by the local record's updated_at).
      projects = [...projects].sort((a, b) => {
        const ta = a.github_pushed_at ? Date.parse(a.github_pushed_at) : 0;
        const tb = b.github_pushed_at ? Date.parse(b.github_pushed_at) : 0;
        if (tb !== ta) return tb - ta;
        return Date.parse(b.updated_at) - Date.parse(a.updated_at);
      });
      // Library total = procgen/imported (reference_assets) + non-rejected generated assets.
      // Merge both per-project counts so the dashboard "Assets" matches the Library's total.
      const [generated, refs] = await Promise.all([
        assetCountsByProject(),
        referenceCountsByProject(),
      ]);
      assetCounts = { ...generated };
      for (const [pid, n] of Object.entries(refs)) {
        assetCounts[pid] = (assetCounts[pid] ?? 0) + n;
      }
    } catch (err) {
      loadFailed = true;
      console.error("HomePage: listProjects failed:", err);
    }
  }
  const stats = computeStats(projects, assetCounts);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[110rem] flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium uppercase tracking-widest text-primary">Crucible</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold sm:text-4xl">Projects</h1>
          {configured && (
            <Button asChild>
              <Link href="/projects/new">+ New Project</Link>
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Your studio at a glance — the numbers up top, the projects below.
        </p>
      </header>

      {!configured ? (
        <SetupNotice />
      ) : loadFailed ? (
        <section
          aria-label="Load error"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-5 text-sm text-muted-foreground"
        >
          Couldn&apos;t load games right now. Check the database connection and refresh.
        </section>
      ) : (
        <>
          <StatRow stats={stats} />
          <GamesGrid projects={projects} />
        </>
      )}
    </main>
  );
}
