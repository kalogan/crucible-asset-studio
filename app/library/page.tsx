import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { getActiveProject } from "@/lib/active-project";
import { listReferenceAssetsByProject } from "@/lib/db/reference-assets";
import { listAssetsByProject } from "@/lib/db/assets";
import { recipeString } from "@/lib/pipeline/paths";
import { LibraryGrid, type LibraryItem } from "@/components/library/LibraryGrid";
import { sortByNewest, countByType } from "@/lib/library/filter";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const configured = isSupabaseConfigured();
  const active = configured ? await getActiveProject() : null;

  let items: LibraryItem[] = [];
  if (configured && active) {
    const [refs, generated] = await Promise.all([
      listReferenceAssetsByProject(active.id),
      listAssetsByProject(active.id),
    ]);
    const refItems: LibraryItem[] = refs.map((r) => ({
      id: r.id,
      label: r.label,
      type: r.asset_type,
      source: "procgen",
      format: r.format,
      url: r.image_path,
      tags: r.tags,
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
        tags: [],
        notes: a.notes,
        createdAt: a.created_at,
        artKitId: null,
      }));
    items = sortByNewest([...refItems, ...genItems]);
  }

  // Per-type read-out for the header (e.g. "prop 12 · creature 8 · biome 5").
  const typeCounts = countByType(items);
  const countsLabel = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${t} ${n}`)
    .join(" · ");

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-12 lg:max-w-5xl xl:max-w-6xl min-[1440px]:max-w-7xl">
      <header className="flex flex-col gap-2">
        <Link href="/" className="w-fit text-sm text-primary underline underline-offset-2">
          ← Games
        </Link>
        <h1 className="text-3xl font-semibold">Asset library</h1>
        {active && (
          <p className="text-sm text-muted-foreground">
            {active.name} — procgen (imported) + generated assets. {items.length} total
            {countsLabel && <span className="text-muted-foreground/80"> · {countsLabel}</span>}.
          </p>
        )}
      </header>

      {!configured ? (
        <p className="text-sm text-muted-foreground">Connect Supabase first (see the home page).</p>
      ) : !active ? (
        <p className="text-sm text-muted-foreground">
          No active project.{" "}
          <Link href="/" className="text-primary underline underline-offset-2">
            Pick one
          </Link>
          .
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No assets yet. Generate some, or import your game’s procgen renders via the import API.
        </p>
      ) : (
        <LibraryGrid items={items} />
      )}
    </main>
  );
}
