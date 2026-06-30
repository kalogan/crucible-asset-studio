import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { listProjects } from "@/lib/db/projects";
import { listAllReferenceAssets } from "@/lib/db/reference-assets";
import { listAllAssets } from "@/lib/db/assets";
import { recipeString } from "@/lib/pipeline/paths";
import { LibraryGrid, type LibraryItem } from "@/components/library/LibraryGrid";
import { sortByNewest } from "@/lib/library/filter";

export const dynamic = "force-dynamic";

// The GLOBAL library — assets across every project (the per-game library lives in the
// workspace sub-nav). Project name is injected as a tag so you can filter by game/app.
export default async function GlobalLibraryPage() {
  const configured = isSupabaseConfigured();
  let items: LibraryItem[] = [];
  let projectCount = 0;
  let loadFailed = false;

  if (configured) {
    try {
      const [projects, refs, generated] = await Promise.all([
        listProjects(),
        listAllReferenceAssets(),
        listAllAssets(),
      ]);
      projectCount = projects.length;
      const nameById = new Map(projects.map((p) => [p.id, p.name]));

      const refItems: LibraryItem[] = refs.map((r) => ({
        id: r.id,
        label: r.label,
        type: r.asset_type,
        source: "procgen",
        format: r.format,
        url: r.image_path,
        tags: [nameById.get(r.project_id) ?? "unknown", ...r.tags],
        notes: r.notes,
        createdAt: r.created_at,
        artKitId: r.art_kit_id,
      }));
      const genItems: LibraryItem[] = generated
        .filter((a) => a.stage !== "rejected")
        .map((a) => ({
          id: a.id,
          label: recipeString(a.recipe_snapshot, "title", "asset"),
          type: "generated",
          source: "generated",
          format: a.kind,
          url: a.raw_path,
          tags: [nameById.get(a.project_id) ?? "unknown"],
          notes: a.notes,
          createdAt: a.created_at,
          artKitId: null,
        }));
      items = sortByNewest([...refItems, ...genItems]);
    } catch (err) {
      loadFailed = true;
      console.error("GlobalLibraryPage: load failed:", err);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-12 lg:max-w-5xl xl:max-w-6xl min-[1440px]:max-w-7xl">
      <header className="flex flex-col gap-2">
        <Link href="/" className="w-fit text-sm text-primary underline underline-offset-2">
          ← Dashboard
        </Link>
        <h1 className="text-3xl font-semibold">Library</h1>
        <p className="text-sm text-muted-foreground">
          Every asset across all {projectCount} projects — procgen (imported) + generated.{" "}
          {items.length} total. Search or filter by the project tag to scope to one game.
        </p>
      </header>

      {!configured ? (
        <p className="text-sm text-muted-foreground">Connect Supabase first (see the dashboard).</p>
      ) : loadFailed ? (
        <p className="text-sm text-destructive">Couldn&apos;t load the library. Check the database and refresh.</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assets yet across any project.</p>
      ) : (
        <LibraryGrid items={items} />
      )}
    </main>
  );
}
