import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { getProjectBySlug } from "@/lib/db/projects";
import { getCanonByProject } from "@/lib/db/canons";
import { canonReadiness } from "@/lib/canon/precision";
import { statusBadgeClass } from "@/lib/projects/status";
import { openWorkspaceAction } from "@/app/actions/projects";
import { ProjectOverviewForm } from "@/components/games/ProjectOverviewForm";
import { ScreenshotUpload } from "@/components/games/ScreenshotUpload";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

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
        <Link href="/" className="w-fit text-sm text-primary underline underline-offset-2">
          ← Games
        </Link>
        <p className="text-sm text-foreground">Game not found.</p>
      </main>
    );
  }

  const canon = await getCanonByProject(project.id);
  const canonState = canon ? (canonReadiness(canon).ready ? "ready" : "incomplete") : "none";

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-6 py-12 lg:max-w-5xl xl:max-w-6xl">
      <header className="flex flex-col gap-3">
        <Link href="/" className="w-fit text-sm text-primary underline underline-offset-2 hover:opacity-80">
          ← Games
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold text-foreground">{project.name}</h1>
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
            className="aspect-video w-full rounded-lg border border-border object-cover"
          />
        )}
      </header>

      {/* Generation workspace — sets this game active, then navigates. */}
      <section aria-label="Generation workspace" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Generation workspace</h2>
          <span className="text-xs text-muted-foreground">
            canon: <span className="text-foreground">{canonState}</span>
          </span>
        </div>
        <form action={openWorkspaceAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="projectId" value={project.id} />
          <Button type="submit" name="target" value="/generate">
            Generate
          </Button>
          <Button type="submit" name="target" value="/review" variant="outline">
            Review
          </Button>
          <Button type="submit" name="target" value="/canon" variant="outline">
            Canon
          </Button>
          <Button type="submit" name="target" value="/library" variant="outline">
            Library
          </Button>
          <Button type="submit" name="target" value="/prompts" variant="outline">
            Prompts
          </Button>
        </form>
      </section>

      {/* Overview — the portfolio face. */}
      <section aria-label="Overview" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">Overview</h2>
        <ScreenshotUpload projectId={project.id} slug={project.slug} />
        <ProjectOverviewForm project={project} />
      </section>
    </main>
  );
}
