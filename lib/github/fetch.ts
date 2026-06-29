import "server-only";
import type { GithubRepoMeta } from "./repo";

/**
 * Fetch a repo's metadata from the GitHub REST API. Works unauthenticated for public
 * repos; set GITHUB_TOKEN to reach private ones (and lift the rate limit). Read-only.
 */
export async function fetchGithubRepo(owner: string, repo: string): Promise<GithubRepoMeta> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "crucible-asset-studio",
    "x-github-api-version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers,
    cache: "no-store",
  });

  if (res.status === 404) {
    throw new Error(`Repo ${owner}/${repo} not found (private repos need GITHUB_TOKEN).`);
  }
  if (res.status === 403) {
    throw new Error("GitHub rate limit hit — set GITHUB_TOKEN and retry.");
  }
  if (!res.ok) throw new Error(`GitHub API error ${res.status}.`);

  const j = (await res.json()) as {
    name?: string;
    description?: string | null;
    homepage?: string | null;
    html_url?: string;
  };
  return {
    name: j.name ?? repo,
    description: j.description ?? null,
    homepage: j.homepage ?? null,
    html_url: j.html_url ?? `https://github.com/${owner}/${repo}`,
  };
}
