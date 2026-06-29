import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { getActiveProject } from "@/lib/active-project";
import { IntakeForm } from "@/components/intake/IntakeForm";

export const dynamic = "force-dynamic";

export default async function IntakePage() {
  const configured = isSupabaseConfigured();
  const active = configured ? await getActiveProject() : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="w-fit rounded text-sm text-amber-300 underline underline-offset-2 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          ← Crucible
        </Link>
        <h1 className="text-3xl font-semibold text-zinc-50">Intake a canon</h1>
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
            Project: <span className="text-zinc-200">{active.name}</span> — paste your
            game&apos;s art-bible text to auto-draft a canon, then carry the fields into the
            Canon panel to save.
          </p>
          <IntakeForm />
          <p className="text-sm text-zinc-400">
            Prefer to write it yourself?{" "}
            <Link
              href="/canon"
              className="rounded text-amber-300 underline underline-offset-2 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              hand-author instead
            </Link>
            .
          </p>
        </>
      )}
    </main>
  );
}
