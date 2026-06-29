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
          className="w-fit rounded text-sm text-primary underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← Crucible
        </Link>
        <h1 className="text-3xl font-semibold text-foreground">Review queue</h1>
        {active && (
          <p className="text-sm text-muted-foreground">
            {active.name} — {assets.length} awaiting review
          </p>
        )}
      </header>

      {!configured ? (
        <p className="text-sm text-foreground">Connect Supabase first (see the home page).</p>
      ) : !active ? (
        <p className="text-sm text-foreground">
          No active project.{" "}
          <Link href="/" className="text-primary underline underline-offset-2">
            Pick one
          </Link>
          .
        </p>
      ) : assets.length === 0 ? (
        <p className="text-sm text-foreground">
          Nothing in review.{" "}
          <Link href="/generate" className="text-primary underline underline-offset-2">
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
