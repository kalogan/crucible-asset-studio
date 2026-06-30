import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { listProjects } from "@/lib/db/projects";
import { assetCountsByProject } from "@/lib/db/assets";
import { parseRepoUrl } from "@/lib/github/repo";
import { fetchRepoInfo } from "@/lib/github/repo-info";
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
  let repoUpdated: Record<string, string> = {};
  let derivedTags: Record<string, { tech: string[]; genres: string[] }> = {};
  let loadFailed = false;
  if (configured) {
    try {
      projects = await listProjects();
      assetCounts = await assetCountsByProject();
      // One cached GitHub call per repo → pushed_at + auto-derived tech/genres.
      const entries = await Promise.all(
        projects.map(async (p) => {
          const ref = p.repo_url ? parseRepoUrl(p.repo_url) : null;
          if (!ref) return null;
          const info = await fetchRepoInfo(ref.owner, ref.repo);
          return { id: p.id, info };
        }),
      );
      for (const e of entries) {
        if (!e) continue;
        if (e.info.pushedAt) repoUpdated[e.id] = e.info.pushedAt;
        if (e.info.tech.length || e.info.genres.length) {
          derivedTags[e.id] = { tech: e.info.tech, genres: e.info.genres };
        }
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
          <h1 className="text-3xl font-semibold sm:text-4xl">Games</h1>
          {configured && (
            <Button asChild>
              <Link href="/projects/new">+ New game</Link>
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Your studio at a glance — the numbers up top, the games below.
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
          <GamesGrid projects={projects} repoUpdated={repoUpdated} derivedTags={derivedTags} />
        </>
      )}
    </main>
  );
}
