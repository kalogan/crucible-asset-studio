import { isSupabaseConfigured } from "@/lib/config";
import { listProjects } from "@/lib/db/projects";
import { CreationsList } from "@/components/creations/CreationsList";

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
        <CreationsList projects={projects} />
      )}
    </main>
  );
}
