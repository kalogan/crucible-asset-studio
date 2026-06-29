import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { getActiveProject } from "@/lib/active-project";
import { listReferenceAssetsByProject } from "@/lib/db/reference-assets";
import { listAssetsByProject } from "@/lib/db/assets";
import { recipeString } from "@/lib/pipeline/paths";
import { EditorView, type EditorModel } from "@/components/editor/EditorView";

export const dynamic = "force-dynamic";

export default async function EditorPage() {
  const configured = isSupabaseConfigured();
  const active = configured ? await getActiveProject() : null;

  // Only MODEL-format assets with a real url are editable. Mirrors the library
  // page's load (procgen refs + non-rejected generated), filtered to 3D models.
  let models: EditorModel[] = [];
  if (configured && active) {
    const [refs, generated] = await Promise.all([
      listReferenceAssetsByProject(active.id),
      listAssetsByProject(active.id),
    ]);
    const refModels: EditorModel[] = refs
      .filter((r) => r.format === "model" && r.image_path)
      .map((r) => ({
        id: `procgen-${r.id}`,
        label: r.label,
        type: r.asset_type,
        url: r.image_path as string,
      }));
    const genModels: EditorModel[] = generated
      .filter((a) => a.stage !== "rejected" && a.kind === "model" && a.raw_path)
      .map((a) => ({
        id: `generated-${a.id}`,
        label: recipeString(a.recipe_snapshot, "title", "asset"),
        type: "generated",
        url: a.raw_path as string,
      }));
    models = [...refModels, ...genModels];
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-12 lg:max-w-5xl xl:max-w-6xl min-[1440px]:max-w-7xl">
      <header className="flex flex-col gap-2">
        <Link href="/" className="w-fit text-sm text-primary underline underline-offset-2">
          ← Games
        </Link>
        <h1 className="text-3xl font-semibold">3D editor</h1>
        {active && (
          <p className="text-sm text-muted-foreground">
            {active.name} — move, rotate, scale and recolor a model, then export the edited GLB.{" "}
            {models.length} model{models.length === 1 ? "" : "s"} available.
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
      ) : models.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No 3D models yet. Generate or import some models to edit them here.
        </p>
      ) : (
        <EditorView models={models} />
      )}
    </main>
  );
}
