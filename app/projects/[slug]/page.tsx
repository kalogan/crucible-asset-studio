import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { getProjectBySlug } from "@/lib/db/projects";
import { statusBadgeClass } from "@/lib/projects/status";
import { ProjectOverviewForm } from "@/components/games/ProjectOverviewForm";
import { ScreenshotUpload } from "@/components/games/ScreenshotUpload";
import { FocalPointPicker } from "@/components/games/FocalPointPicker";
import { SuggestTags } from "@/components/games/SuggestTags";

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

  const isGame = project.kind === "game";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[110rem] flex-col gap-8 px-6 pb-12">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold text-foreground">{project.name}</h1>
          <span className="rounded border border-border px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {project.kind}
          </span>
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
            style={{
              objectPosition: `${project.screenshot_focal_x * 100}% ${project.screenshot_focal_y * 100}%`,
            }}
            className="aspect-video w-full rounded-lg border border-border object-cover"
          />
        )}
        {(project.url || project.repo_url) && (
          <div className="flex flex-wrap gap-3 text-sm">
            {project.url && (
              <a href={project.url} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                {isGame ? "Play ↗" : "Open ↗"}
              </a>
            )}
            {project.repo_url && (
              <a href={project.repo_url} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                Repo ↗
              </a>
            )}
          </div>
        )}
      </header>

      {/* The asset-gen tabs (games) live in the WorkspaceNav above. */}

      {/* Overview — the portfolio face (both kinds). */}
      <section aria-label="Overview" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">Overview</h2>
        <ScreenshotUpload projectId={project.id} slug={project.slug} />
        {project.screenshot && (
          <FocalPointPicker
            projectId={project.id}
            slug={project.slug}
            screenshot={project.screenshot}
            focalX={project.screenshot_focal_x}
            focalY={project.screenshot_focal_y}
          />
        )}
        {project.repo_url && <SuggestTags projectId={project.id} slug={project.slug} />}
        <ProjectOverviewForm project={project} />
      </section>
    </main>
  );
}
