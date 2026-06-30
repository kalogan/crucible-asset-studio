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
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-12 lg:max-w-5xl xl:max-w-6xl min-[1440px]:max-w-7xl">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="w-fit rounded text-sm text-primary underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← Crucible
        </Link>
        <h1 className="text-3xl font-semibold text-foreground">Canon</h1>
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
            Project: <span className="text-foreground">{active.name}</span> — the style
            guide that scaffolds every generation.
          </p>

          {readiness && (
            <section aria-label="Canon readiness" className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-foreground">Readiness</h2>
              {readiness.ready ? (
                <p className="text-sm font-medium text-accent">Canon ready ✓</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium text-primary">
                    Not ready — missing:
                  </p>
                  <ul className="flex flex-col gap-1 text-sm text-destructive">
                    {readiness.missing.map((m) => (
                      <li key={m} className="flex gap-2">
                        <span aria-hidden className="text-destructive">
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
            <h2 className="text-lg font-semibold text-foreground">
              {canon ? "Edit canon" : "Create canon"}
            </h2>
            {!canon && (
              <div className="flex flex-col gap-4 rounded-md border border-primary/40 bg-primary/5 p-4">
                <p className="text-sm text-foreground">
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
