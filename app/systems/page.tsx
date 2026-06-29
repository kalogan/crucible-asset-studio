import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { getActiveProject } from "@/lib/active-project";
import { listReferenceAssetsByProject } from "@/lib/db/reference-assets";
import { listAssetsByProject } from "@/lib/db/assets";
import { listAssetSystemsByProject } from "@/lib/db/asset-systems";
import { recipeString } from "@/lib/pipeline/paths";
import {
  CreateSystemForm,
  type SystemAssetOption,
} from "@/components/systems/CreateSystemForm";
import { DownloadManifestButton } from "@/components/systems/DownloadManifestButton";
import { EditSystemPanel } from "@/components/systems/EditSystemPanel";
import type { AssetSystem } from "@/lib/asset-system/schema";

export const dynamic = "force-dynamic";

export default async function SystemsPage() {
  const configured = isSupabaseConfigured();
  const active = configured ? await getActiveProject() : null;

  let assetOptions: SystemAssetOption[] = [];
  let systems: AssetSystem[] = [];
  if (configured && active) {
    const [refs, generated, sys] = await Promise.all([
      listReferenceAssetsByProject(active.id),
      listAssetsByProject(active.id),
      listAssetSystemsByProject(active.id),
    ]);
    // A system bundles meshes — offer the project's MODEL assets as parts.
    const refOptions: SystemAssetOption[] = refs
      .filter((r) => r.format === "model")
      .map((r) => ({ id: r.id, label: r.label, type: r.asset_type }));
    const genOptions: SystemAssetOption[] = generated
      .filter((a) => a.stage !== "rejected" && a.kind === "model")
      .map((a) => ({
        id: a.id,
        label: recipeString(a.recipe_snapshot, "title", "asset"),
        type: "generated",
      }));
    assetOptions = [...refOptions, ...genOptions];
    systems = sys;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-12 lg:max-w-5xl xl:max-w-6xl min-[1440px]:max-w-7xl">
      <header className="flex flex-col gap-2">
        <Link href="/" className="w-fit text-sm text-primary underline underline-offset-2">
          ← Games
        </Link>
        <h1 className="text-3xl font-semibold">Asset systems</h1>
        {active && (
          <p className="text-sm text-muted-foreground">
            {active.name} — reusable bundles of library assets. {systems.length} total.
          </p>
        )}
      </header>

      {!configured ? (
        <p className="text-sm text-muted-foreground">
          Connect Supabase first (see the home page).
        </p>
      ) : !active ? (
        <p className="text-sm text-muted-foreground">
          No active project.{" "}
          <Link href="/" className="text-primary underline underline-offset-2">
            Pick one
          </Link>
          .
        </p>
      ) : (
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-4">
            <h2 className="font-serif text-lg font-semibold">New system</h2>
            {assetOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No model assets yet. Generate or import some 3D assets via the{" "}
                <Link href="/library" className="text-primary underline underline-offset-2">
                  library
                </Link>
                .
              </p>
            ) : (
              <CreateSystemForm assets={assetOptions} />
            )}
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="font-serif text-lg font-semibold">Saved systems</h2>
            {systems.length === 0 ? (
              <p className="text-sm text-muted-foreground" role="status">
                No systems yet. Group some assets above.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {systems.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">{s.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {s.manifest.parts.length}{" "}
                          {s.manifest.parts.length === 1 ? "part" : "parts"}
                          {s.manifest.lights?.length
                            ? ` · ${s.manifest.lights.length} light${s.manifest.lights.length === 1 ? "" : "s"}`
                            : ""}
                          {s.manifest.sounds?.length
                            ? ` · ${s.manifest.sounds.length} sound${s.manifest.sounds.length === 1 ? "" : "s"}`
                            : ""}
                          {s.description ? ` · ${s.description}` : ""}
                        </span>
                      </div>
                      <DownloadManifestButton name={s.name} manifest={s.manifest} />
                    </div>
                    <EditSystemPanel systemId={s.id} manifest={s.manifest} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
