import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { getActiveProject } from "@/lib/active-project";
import { getCanonByProject } from "@/lib/db/canons";
import { canonReadiness } from "@/lib/canon/precision";
import { CanonForm } from "@/components/canon/CanonForm";
import { SeedCanonButton } from "@/components/canon/SeedCanonButton";
import { TrainingImages } from "@/components/lora/TrainingImages";
import { listTrainingImages } from "@/lib/lora/storage";

export const dynamic = "force-dynamic";

export default async function CanonPage() {
  const configured = isSupabaseConfigured();
  const active = configured ? await getActiveProject() : null;
  const canon = active ? await getCanonByProject(active.id) : null;
  const readiness = canon ? canonReadiness(canon) : null;
  const trainingImages = active && canon ? await listTrainingImages(active.slug) : [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="w-fit rounded text-sm text-amber-300 underline underline-offset-2 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          ← Crucible
        </Link>
        <h1 className="text-3xl font-semibold text-zinc-50">Canon</h1>
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
            Project: <span className="text-zinc-200">{active.name}</span> — the style
            guide that scaffolds every generation.
          </p>

          {readiness && (
            <section aria-label="Canon readiness" className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-zinc-100">Readiness</h2>
              {readiness.ready ? (
                <p className="text-sm font-medium text-emerald-300">Canon ready ✓</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium text-amber-300">
                    Not ready — missing:
                  </p>
                  <ul className="flex flex-col gap-1 text-sm text-rose-300">
                    {readiness.missing.map((m) => (
                      <li key={m} className="flex gap-2">
                        <span aria-hidden className="text-rose-400">
                          •
                        </span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <section aria-label="Canon details" className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-zinc-100">
              {canon ? "Edit canon" : "Create canon"}
            </h2>
            {!canon && (
              <div className="flex flex-col gap-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="text-sm text-zinc-300">
                  No canon yet. Seed the Wayfinders canon from the art bible, or fill
                  in the fields below.
                </p>
                <SeedCanonButton />
              </div>
            )}
            <CanonForm canon={canon} />
          </section>

          {canon && (
            <TrainingImages
              images={trainingImages}
              triggerWord={canon.lora_trigger}
            />
          )}
        </>
      )}
    </main>
  );
}
