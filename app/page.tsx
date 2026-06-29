import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { listProjects } from "@/lib/db/projects";
import { GamesGrid } from "@/components/games/GamesGrid";

// Games gallery — the front door. Reads the PORTFOLIO face only.
export const dynamic = "force-dynamic";

function SetupNotice() {
  return (
    <section
      aria-label="Setup required"
      className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-5"
    >
      <h2 className="text-lg font-semibold text-amber-300">Connect Supabase to begin</h2>
      <p className="mt-2 text-sm text-zinc-300">
        Copy <code className="rounded bg-zinc-800 px-1.5 py-0.5">.env.example</code> to{" "}
        <code className="rounded bg-zinc-800 px-1.5 py-0.5">.env.local</code>, fill in your
        Supabase keys, then run <code className="rounded bg-zinc-800 px-1.5 py-0.5">pnpm migrate</code>.
      </p>
    </section>
  );
}

export default async function HomePage() {
  const configured = isSupabaseConfigured();
  const projects = configured ? await listProjects() : [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium uppercase tracking-widest text-amber-400">Crucible</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-zinc-50 sm:text-4xl">Games</h1>
          {configured && (
            <Link
              href="/projects/new"
              className="inline-flex min-h-11 items-center rounded-md bg-amber-500 px-4 font-medium text-zinc-950 hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              + New game
            </Link>
          )}
        </div>
        <p className="text-sm text-zinc-400">
          Every game is a project — see them all here, then generate assets for each.
        </p>
      </header>

      {!configured ? <SetupNotice /> : <GamesGrid projects={projects} />}
    </main>
  );
}
