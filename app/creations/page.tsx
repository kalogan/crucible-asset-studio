import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { listProjects } from "@/lib/db/projects";
import { statusBadgeClass } from "@/lib/projects/status";
import { timeAgo } from "@/lib/util/time";

export const dynamic = "force-dynamic";

// A flat, scannable list of every experience (games + apps) — distinct from the Home
// dashboard's stats + cards. README blurbs are STORED in the DB (by `pnpm refresh-github`),
// so this reads them without a live GitHub fetch.
export default async function CreationsPage() {
  const configured = isSupabaseConfigured();
  let projects: Awaited<ReturnType<typeof listProjects>> = [];
  let loadFailed = false;
  if (configured) {
    try {
      projects = await listProjects();
    } catch (err) {
      loadFailed = true;
      console.error("CreationsPage: listProjects failed:", err);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[110rem] flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Creations</h1>
        <p className="text-sm text-muted-foreground">
          Every experience you&apos;ve built — {projects.length} total.
        </p>
      </header>

      {!configured ? (
        <p className="text-sm text-muted-foreground">Connect Supabase first (see Home).</p>
      ) : loadFailed ? (
        <p className="text-sm text-destructive">Couldn&apos;t load creations. Check the database and refresh.</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet — create a game or app from Home.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
          {projects.map((p) => (
            <li key={p.id} className="flex items-center gap-5 p-4">
              <Link
                href={`/projects/${p.slug}`}
                className="group flex min-w-0 flex-1 items-center gap-5 focus-visible:outline-none"
              >
                <div className="aspect-video h-24 shrink-0 overflow-hidden rounded-md bg-muted sm:h-28">
                  {p.screenshot && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.screenshot}
                      alt=""
                      style={{
                        objectPosition: `${p.screenshot_focal_x * 100}% ${p.screenshot_focal_y * 100}%`,
                      }}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-base font-semibold text-foreground group-hover:text-primary">
                      {p.name}
                    </span>
                    <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {p.kind}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(p.status)}`}
                    >
                      {p.status}
                    </span>
                  </div>
                  {(p.summary || p.description) && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {p.summary || p.description}
                    </p>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Updated {timeAgo(p.updated_at) || "—"}
                  </span>
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-3 text-sm">
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    {p.kind === "app" ? "Open" : "Play"} ↗
                  </a>
                )}
                {p.repo_url && (
                  <a
                    href={p.repo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Repo ↗
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
