/**
 * Pure helpers for the "import a game from GitHub" flow — parse a repo reference and map
 * its GitHub metadata to a Crucible project. No network here (see fetch.ts); kept pure so
 * the URL parsing + field mapping are unit-testable.
 */

export interface RepoRef {
  owner: string;
  repo: string;
}

/** GitHub repo metadata we consume (subset of the REST `GET /repos/{o}/{r}` response). */
export interface GithubRepoMeta {
  name: string;
  description: string | null;
  homepage: string | null;
  html_url: string;
}

/**
 * Parse a GitHub repo from a URL (https or git@), or an `owner/repo` shorthand. Strips a
 * trailing `.git` and slashes. Returns null if it can't find both parts.
 */
export function parseRepoUrl(input: string): RepoRef | null {
  // Strip trailing slashes first, then a trailing `.git` (handles "…/repo.git/").
  const s = input.trim().replace(/\/+$/, "").replace(/\.git$/i, "").replace(/\/+$/, "");
  if (!s) return null;
  let owner: string | undefined;
  let repo: string | undefined;
  if (/github\.com/i.test(s)) {
    const m = s.match(/github\.com[/:]([^/\s]+)\/([^/\s?#]+)/i);
    owner = m?.[1];
    repo = m?.[2];
  } else {
    const m = s.match(/^([^/\s]+)\/([^/\s]+)$/);
    owner = m?.[1];
    repo = m?.[2];
  }
  return owner && repo ? { owner, repo } : null;
}

/** Kebab-case slug matching the project slugSchema (a-z0-9, single hyphens, trimmed). */
export function toSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

/** "storm-break-hockey" → "Storm Break Hockey" (a display name from the repo slug). */
export function titleCase(s: string): string {
  return toSlug(s)
    .split("-")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

export interface MappedProject {
  slug: string;
  name: string;
  description: string | null;
  url: string | null;
  repo_url: string;
}

/** Map GitHub repo metadata → the fields Crucible's project create needs. */
export function mapRepoToProject(meta: GithubRepoMeta): MappedProject {
  return {
    slug: toSlug(meta.name),
    name: titleCase(meta.name),
    description: meta.description?.trim() || null,
    url: meta.homepage?.trim() || null,
    repo_url: meta.html_url,
  };
}
