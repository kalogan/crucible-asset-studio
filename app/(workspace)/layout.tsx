import { isSupabaseConfigured } from "@/lib/config";
import { getActiveProject } from "@/lib/active-project";
import { WorkspaceNav } from "@/components/nav/WorkspaceNav";

export const dynamic = "force-dynamic";

/**
 * Shared layout for the per-game asset-gen workspace (generate/review/canon/library/
 * prompts). Renders the game-scoped sub-nav + breadcrumb so game context is always
 * explicit; the global top nav holds only studio-wide tools. URLs are unchanged (a
 * route group).
 */
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const active = isSupabaseConfigured() ? await getActiveProject() : null;
  return (
    <div className="mx-auto w-full max-w-4xl px-6 pt-6 lg:max-w-5xl xl:max-w-6xl min-[1440px]:max-w-7xl">
      <WorkspaceNav activeName={active?.name ?? null} activeSlug={active?.slug ?? null} />
      {children}
    </div>
  );
}
