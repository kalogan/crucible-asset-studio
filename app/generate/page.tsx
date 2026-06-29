import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { getActiveProject } from "@/lib/active-project";
import { getCanonByProject } from "@/lib/db/canons";
import { canonReadiness } from "@/lib/canon/precision";
import { GenerateForm } from "@/components/generate/GenerateForm";

export const dynamic = "force-dynamic";

export default async function GeneratePage() {
  const configured = isSupabaseConfigured();
  const active = configured ? await getActiveProject() : null;
  const canon = active ? await getCanonByProject(active.id) : null;
  const canonReady = canon ? canonReadiness(canon).ready : false;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="w-fit rounded text-sm text-amber-300 underline underline-offset-2 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          ← Crucible
        </Link>
        <h1 className="text-3xl font-semibold text-zinc-50">Generate an asset</h1>
      </header>

      {!configured ? (
        <p className="text-sm text-zinc-300">Connect Supabase first (see the home page).</p>
      ) : !active ? (
        <p className="text-sm text-zinc-300">
          No active project.{" "}
          <Link href="/" className="text-amber-300 underline underline-offset-2">
            Pick or create one
          </Link>{" "}
          first.
        </p>
      ) : (
        <>
          <p className="text-sm text-zinc-400">
            Project: <span className="text-zinc-200">{active.name}</span> — 2D → 3D
            through FLUX and TRELLIS, landing in the review queue.
          </p>
          {canon && canonReady ? (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-300">
              Canon: <span className="font-medium">{canon.name}</span> ✓ — output is
              styled to your canon.
            </p>
          ) : canon && !canonReady ? (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-300">
              Canon “{canon.name}” isn’t ready —{" "}
              <Link href="/canon" className="underline underline-offset-2">
                finish it
              </Link>{" "}
              to generate.
            </p>
          ) : (
            <p className="rounded-md border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-400">
              No canon set — output won’t be on-style.{" "}
              <Link href="/canon" className="text-amber-300 underline underline-offset-2">
                Set up a canon
              </Link>
              .
            </p>
          )}
          <GenerateForm />
        </>
      )}
    </main>
  );
}
