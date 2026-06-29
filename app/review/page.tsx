import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { getActiveProject } from "@/lib/active-project";
import { listAssetsByProject } from "@/lib/db/assets";
import { ReviewItem } from "@/components/review/ReviewItem";
import { recipeString } from "@/lib/pipeline/paths";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const configured = isSupabaseConfigured();
  const active = configured ? await getActiveProject() : null;
  const assets = configured && active
    ? await listAssetsByProject(active.id, "in_review")
    : [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="w-fit rounded text-sm text-amber-300 underline underline-offset-2 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          ← Crucible
        </Link>
        <h1 className="text-3xl font-semibold text-zinc-50">Review queue</h1>
        {active && (
          <p className="text-sm text-zinc-400">
            {active.name} — {assets.length} awaiting review
          </p>
        )}
      </header>

      {!configured ? (
        <p className="text-sm text-zinc-300">Connect Supabase first (see the home page).</p>
      ) : !active ? (
        <p className="text-sm text-zinc-300">
          No active project.{" "}
          <Link href="/" className="text-amber-300 underline underline-offset-2">
            Pick one
          </Link>
          .
        </p>
      ) : assets.length === 0 ? (
        <p className="text-sm text-zinc-300">
          Nothing in review.{" "}
          <Link href="/generate" className="text-amber-300 underline underline-offset-2">
            Generate an asset
          </Link>
          .
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {assets.map((asset) => (
            <ReviewItem
              key={asset.id}
              asset={asset}
              title={recipeString(asset.recipe_snapshot, "title", asset.id)}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
