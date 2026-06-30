import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { listProjects } from "@/lib/db/projects";
import { GamesGrid } from "@/components/games/GamesGrid";
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
  let loadFailed = false;
  if (configured) {
    try {
      projects = await listProjects();
    } catch (err) {
      loadFailed = true;
      console.error("HomePage: listProjects failed:", err);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-12 lg:max-w-5xl xl:max-w-6xl min-[1440px]:max-w-7xl">
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
          Every game is a project — see them all here, then generate assets for each.
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
        <GamesGrid projects={projects} />
      )}
    </main>
  );
}
