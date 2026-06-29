import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { getProjectBySlug } from "@/lib/db/projects";
import { getCanonByProject } from "@/lib/db/canons";
import { canonReadiness } from "@/lib/canon/precision";
import { statusBadgeClass } from "@/lib/projects/status";
import { openWorkspaceAction } from "@/app/actions/projects";
import { ProjectOverviewForm } from "@/components/games/ProjectOverviewForm";

export const dynamic = "force-dynamic";

const wsBtn =
  "min-h-11 rounded-md border border-zinc-700 px-4 font-medium text-zinc-100 hover:bg-zinc-800 " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = isSupabaseConfigured() ? await getProjectBySlug(slug) : null;

  if (!project) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 px-6 py-12">
        <Link href="/" className="w-fit text-sm text-amber-300 underline underline-offset-2">
          ← Games
        </Link>
        <p className="text-sm text-zinc-300">Game not found.</p>
      </main>
    );
  }

  const canon = await getCanonByProject(project.id);
  const canonState = canon ? (canonReadiness(canon).ready ? "ready" : "incomplete") : "none";

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-3">
        <Link href="/" className="w-fit text-sm text-amber-300 underline underline-offset-2 hover:text-amber-200">
          ← Games
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold text-zinc-50">{project.name}</h1>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(project.status)}`}
          >
            {project.status}
          </span>
        </div>
        {project.screenshot && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.screenshot}
            alt={`${project.name} screenshot`}
            className="aspect-video w-full rounded-lg border border-zinc-800 object-cover"
          />
        )}
      </header>

      {/* Generation workspace — sets this game active, then navigates. */}
      <section aria-label="Generation workspace" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-zinc-100">Generation workspace</h2>
          <span className="text-xs text-zinc-400">
            canon: <span className="text-zinc-200">{canonState}</span>
          </span>
        </div>
        <form action={openWorkspaceAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="projectId" value={project.id} />
          <button type="submit" name="target" value="/generate" className={`${wsBtn} bg-amber-500 text-zinc-950 hover:bg-amber-400`}>
            Generate
          </button>
          <button type="submit" name="target" value="/review" className={wsBtn}>
            Review
          </button>
          <button type="submit" name="target" value="/canon" className={wsBtn}>
            Canon
          </button>
          <button type="submit" name="target" value="/prompts" className={wsBtn}>
            Prompts
          </button>
        </form>
      </section>

      {/* Overview — the portfolio face. */}
      <section aria-label="Overview" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-100">Overview</h2>
        <ProjectOverviewForm project={project} />
      </section>
    </main>
  );
}
