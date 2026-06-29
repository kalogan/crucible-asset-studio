import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { listProjects } from "@/lib/db/projects";
import { statusBadgeClass } from "@/lib/projects/status";
import { NewGameForm } from "@/components/games/NewGameForm";

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
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-widest text-amber-400">Crucible</p>
        <h1 className="text-3xl font-semibold text-zinc-50 sm:text-4xl">Games</h1>
        <p className="text-sm text-zinc-400">
          Every game is a project — see them all here, then generate assets for each.
        </p>
      </header>

      {!configured ? (
        <SetupNotice />
      ) : (
        <>
          <NewGameForm />

          {projects.length === 0 ? (
            <p className="text-sm text-zinc-300">No games yet — create your first above.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {projects.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50"
                >
                  <Link
                    href={`/projects/${p.slug}`}
                    className="group flex flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                  >
                    <div className="aspect-video w-full overflow-hidden bg-zinc-900">
                      {p.screenshot ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.screenshot}
                          alt={`${p.name} screenshot`}
                          className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-zinc-600">
                          No screenshot
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="font-semibold text-zinc-50 group-hover:text-amber-200">
                          {p.name}
                        </h2>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(p.status)}`}
                        >
                          {p.status}
                        </span>
                      </div>
                      {p.description && (
                        <p className="line-clamp-2 text-sm text-zinc-400">{p.description}</p>
                      )}
                    </div>
                  </Link>
                  {p.url && (
                    <div className="px-4 pb-4">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded text-sm text-amber-300 underline underline-offset-2 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                      >
                        Play ↗
                      </a>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
