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
          className="w-fit rounded text-sm text-primary underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← Crucible
        </Link>
        <h1 className="text-3xl font-semibold text-foreground">Intake a canon</h1>
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
            Project: <span className="text-foreground">{active.name}</span> — paste your
            game&apos;s art-bible text to auto-draft a canon, then carry the fields into the
            Canon panel to save.
          </p>
          <IntakeForm />
          <p className="text-sm text-muted-foreground">
            Prefer to write it yourself?{" "}
            <Link
              href="/canon"
              className="rounded text-primary underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
