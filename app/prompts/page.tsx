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
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="w-fit rounded text-sm text-amber-300 underline underline-offset-2 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          ← Crucible
        </Link>
        <h1 className="text-3xl font-semibold text-zinc-50">Prompt library</h1>
        {active && (
          <p className="text-sm text-zinc-400">
            {active.name} — {specs.length} past prompt{specs.length === 1 ? "" : "s"}. Reuse one
            and tweak it.
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
      ) : specs.length === 0 ? (
        <p className="text-sm text-zinc-300">
          No prompts yet.{" "}
          <Link href="/generate" className="text-amber-300 underline underline-offset-2">
            Generate an asset
          </Link>{" "}
          and it’ll show up here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {specs.map((s) => (
            <li
              key={s.id}
              className="flex gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900">
                {s.thumbPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.thumbPath}
                    alt={s.title}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-500">
                    {s.assetKind === "model" ? "3D" : "—"}
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h2 className="font-medium text-zinc-100">{s.title}</h2>
                <p className="line-clamp-2 text-sm text-zinc-400">{s.prompt}</p>
                <Link
                  href={`/generate?title=${encodeURIComponent(s.title)}&prompt=${encodeURIComponent(s.prompt)}`}
                  className="mt-1 inline-flex min-h-11 w-fit items-center rounded-md border border-zinc-700 px-3 text-sm font-medium text-amber-300 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
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
