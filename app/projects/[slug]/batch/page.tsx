import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { getActiveProject } from "@/lib/active-project";
import { listSpecsByProject } from "@/lib/db/specs";
import { listBatchesByProject, type BatchWithRollup } from "@/lib/db/batches";
import { EnqueueBatchForm } from "@/components/batch/EnqueueBatchForm";
import { RunDryRunButton } from "@/components/batch/RunDryRunButton";

export const dynamic = "force-dynamic";

const STAT_LABELS: { key: keyof BatchWithRollup["rollup"]; label: string; cls: string }[] = [
  { key: "queued", label: "queued", cls: "text-muted-foreground" },
  { key: "generating", label: "generating", cls: "text-primary" },
  { key: "succeeded", label: "succeeded", cls: "text-accent" },
  { key: "failed", label: "failed", cls: "text-destructive" },
];

function batchStatusClass(status: BatchWithRollup["status"]): string {
  switch (status) {
    case "done":
      return "border-accent/30 bg-accent/10 text-accent";
    case "running":
      return "border-primary/30 bg-primary/10 text-primary";
    case "failed":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "queued":
    default:
      return "border-border bg-secondary text-muted-foreground";
  }
}

export default async function BatchPage() {
  const configured = isSupabaseConfigured();
  const active = configured ? await getActiveProject() : null;
  const specs = configured && active ? await listSpecsByProject(active.id) : [];
  const batches = configured && active ? await listBatchesByProject(active.id) : [];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[110rem] flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="w-fit rounded text-sm text-primary underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← Crucible
        </Link>
        <h1 className="text-3xl font-semibold text-foreground">Batches</h1>
        {active && (
          <p className="text-sm text-muted-foreground">
            {active.name} — queue a set of specs, then drain them with the worker.
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
      ) : (
        <>
          <div
            role="note"
            className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
          >
            Runs here are <span className="font-medium text-foreground">dry-runs</span> — mock
            generation, no provider call, <span className="font-medium text-foreground">$0</span>.
            Real (paid) batch runs are gated server-side behind{" "}
            <code className="rounded bg-background px-1 py-0.5 text-xs">CRUCIBLE_ALLOW_PAID_BATCH</code>{" "}
            and are not triggerable from this page.
          </div>

          <section aria-label="Enqueue a batch" className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-foreground">Enqueue a batch</h2>
            <EnqueueBatchForm specs={specs} />
          </section>

          <section aria-label="Batches" className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              This project’s batches ({batches.length})
            </h2>
            {batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No batches yet — enqueue one above.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {batches.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-foreground">{b.name}</h3>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${batchStatusClass(b.status)}`}
                        >
                          {b.status}
                        </span>
                        {b.dry_run && (
                          <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            dry-run
                          </span>
                        )}
                      </div>
                      <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <div className="flex gap-1">
                          <dt className="text-muted-foreground">jobs</dt>
                          <dd className="font-medium text-foreground">{b.rollup.total}</dd>
                        </div>
                        {STAT_LABELS.map((s) => (
                          <div key={s.key} className="flex gap-1">
                            <dt className="text-muted-foreground">{s.label}</dt>
                            <dd className={`font-medium ${s.cls}`}>{b.rollup[s.key]}</dd>
                          </div>
                        ))}
                        <div className="flex gap-1">
                          <dt className="text-muted-foreground">est.</dt>
                          <dd className="font-medium text-foreground">
                            ${b.cost_estimate.toFixed(2)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <RunDryRunButton batchId={b.id} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
