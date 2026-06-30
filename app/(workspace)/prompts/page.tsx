import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { getActiveProject } from "@/lib/active-project";
import { listSpecsWithAssetByProject } from "@/lib/db/specs";

export const dynamic = "force-dynamic";

export default async function PromptsPage() {
  const configured = isSupabaseConfigured();
  const active = configured ? await getActiveProject() : null;
  const specs = configured && active ? await listSpecsWithAssetByProject(active.id) : [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-6 py-12 lg:max-w-5xl xl:max-w-6xl">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="w-fit rounded text-sm text-primary underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← Crucible
        </Link>
        <h1 className="text-3xl font-semibold text-foreground">Prompt library</h1>
        {active && (
          <p className="text-sm text-muted-foreground">
            {active.name} — {specs.length} past prompt{specs.length === 1 ? "" : "s"}. Reuse one
            and tweak it.
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
      ) : specs.length === 0 ? (
        <p className="text-sm text-foreground">
          No prompts yet.{" "}
          <Link href="/generate" className="text-primary underline underline-offset-2">
            Generate an asset
          </Link>{" "}
          and it’ll show up here.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {specs.map((s) => (
            <li
              key={s.id}
              className="flex gap-4 rounded-lg border border-border bg-card p-4"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                {s.thumbPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.thumbPath}
                    alt={s.title}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                    {s.assetKind === "model" ? "3D" : "—"}
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h2 className="font-medium text-foreground">{s.title}</h2>
                <p className="line-clamp-2 text-sm text-muted-foreground">{s.prompt}</p>
                <Link
                  href={`/generate?title=${encodeURIComponent(s.title)}&prompt=${encodeURIComponent(s.prompt)}`}
                  className="mt-1 inline-flex min-h-11 w-fit items-center rounded-md border border-input px-3 text-sm font-medium text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Reuse & tweak →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
