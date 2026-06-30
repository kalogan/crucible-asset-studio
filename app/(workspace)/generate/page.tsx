import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { getActiveProject } from "@/lib/active-project";
import { getCanonByProject } from "@/lib/db/canons";
import { canonReadiness } from "@/lib/canon/precision";
import { GenerateForm } from "@/components/generate/GenerateForm";

export const dynamic = "force-dynamic";

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; prompt?: string }>;
}) {
  const sp = await searchParams;
  const configured = isSupabaseConfigured();
  const active = configured ? await getActiveProject() : null;
  const canon = active ? await getCanonByProject(active.id) : null;
  const canonReady = canon ? canonReadiness(canon).ready : false;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-6 py-12 lg:max-w-4xl xl:max-w-5xl">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="w-fit rounded text-sm text-primary underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← Crucible
        </Link>
        <h1 className="text-3xl font-semibold text-foreground">Generate an asset</h1>
      </header>

      {!configured ? (
        <p className="text-sm text-foreground">Connect Supabase first (see the home page).</p>
      ) : !active ? (
        <p className="text-sm text-foreground">
          No active project.{" "}
          <Link href="/" className="text-primary underline underline-offset-2">
            Pick or create one
          </Link>{" "}
          first.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Project: <span className="text-foreground">{active.name}</span> — 2D → 3D
            through FLUX and TRELLIS, landing in the review queue.
          </p>
          {canon && canonReady ? (
            <p className="rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-sm text-accent">
              Canon: <span className="font-medium">{canon.name}</span> ✓ — output is
              styled to your canon.
            </p>
          ) : canon && !canonReady ? (
            <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
              Canon “{canon.name}” isn’t ready —{" "}
              <Link href="/canon" className="underline underline-offset-2">
                finish it
              </Link>{" "}
              to generate.
            </p>
          ) : (
            <p className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              No canon set — output won’t be on-style.{" "}
              <Link href="/canon" className="text-primary underline underline-offset-2">
                Set up a canon
              </Link>
              .
            </p>
          )}
          <GenerateForm initialTitle={sp.title ?? ""} initialPrompt={sp.prompt ?? ""} />
        </>
      )}
    </main>
  );
}
