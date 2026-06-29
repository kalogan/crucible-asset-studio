import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { listProjects } from "@/lib/db/projects";
import { getActiveProject } from "@/lib/active-project";
import { ProjectSwitcher } from "@/components/projects/ProjectSwitcher";

// Reads cookies + DB per request — never prerender (no keys at build time).
export const dynamic = "force-dynamic";

function SetupNotice() {
  return (
    <section
      aria-label="Setup required"
      className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-5"
    >
      <h2 className="text-lg font-semibold text-amber-300">Connect Supabase to begin</h2>
      <p className="mt-2 text-sm text-zinc-300">
        Copy{" "}
        <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-100">.env.example</code>{" "}
        to <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-100">.env.local</code>{" "}
        and fill in your Supabase URL + keys, then run the migrations in{" "}
        <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-100">
          supabase/migrations
        </code>
        .
      </p>
    </section>
  );
}

export default async function HomePage() {
  const configured = isSupabaseConfigured();
  const projects = configured ? await listProjects() : [];
  const active = configured ? await getActiveProject() : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-widest text-amber-400">
          Crucible
        </p>
        <h1 className="text-3xl font-semibold text-zinc-50 sm:text-4xl">Asset studio</h1>
        <p className="text-sm text-zinc-400">
          Multi-game from line one — every asset hangs off a project.
        </p>
      </header>

      {!configured ? (
        <SetupNotice />
      ) : (
        <>
          <ProjectSwitcher projects={projects} activeId={active?.id ?? null} />

          <section
            aria-label="Active project"
            className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5"
          >
            {active ? (
              <div className="flex flex-col gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-50">{active.name}</h2>
                  <p className="text-sm text-zinc-400">
                    slug: <span className="text-zinc-300">{active.slug}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/generate"
                    className="inline-flex min-h-11 w-fit items-center rounded-md bg-amber-500 px-4 font-medium text-zinc-950 hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                  >
                    Generate an asset →
                  </Link>
                  <Link
                    href="/review"
                    className="inline-flex min-h-11 w-fit items-center rounded-md border border-zinc-700 px-4 font-medium text-zinc-100 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                  >
                    Review queue
                  </Link>
                  <Link
                    href="/canon"
                    className="inline-flex min-h-11 w-fit items-center rounded-md border border-zinc-700 px-4 font-medium text-zinc-100 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                  >
                    Canon
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-400">
                {projects.length > 0
                  ? "Pick a project above to make it active."
                  : "Create your first project to get started."}
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
