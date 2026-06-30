import { isSupabaseConfigured } from "@/lib/config";
import { getProjectBySlug, listProjects } from "@/lib/db/projects";
import { WorkspaceNav } from "@/components/nav/WorkspaceNav";

export const dynamic = "force-dynamic";

/**
 * The per-project shell. Resolves the project by slug and renders WorkspaceNav
 * (breadcrumb + switcher + the project's tabs) above the overview / workspace pages.
 * The URL carries the project (middleware forwards the slug), so the workspace is
 * never ambiguous.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const configured = isSupabaseConfigured();
  const project = configured ? await getProjectBySlug(slug) : null;
  const projects = configured ? await listProjects() : [];

  return (
    <>
      <WorkspaceNav
        slug={slug}
        name={project?.name ?? null}
        kind={project?.kind ?? "game"}
        projects={projects.map((p) => ({ slug: p.slug, name: p.name, kind: p.kind }))}
      />
      {children}
    </>
  );
}
