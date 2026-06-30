import "server-only";

export interface LatestCommit {
  /** First line of the latest commit message. */
  message: string;
  /** ISO date of the latest commit. */
  date: string;
}

/**
 * Fetch the latest commit for a repo (message + date). Cached 30 min via the Next Data
 * Cache so the dashboard doesn't hammer the GitHub API. Returns null on any failure
 * (no repo, rate limit, error) so the card degrades gracefully. GITHUB_TOKEN lifts limits.
 */
export async function fetchLatestCommit(
  owner: string,
  repo: string,
): Promise<LatestCommit | null> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "crucible-asset-studio",
    "x-github-api-version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
      { headers, next: { revalidate: 1800 } },
    );
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{
      commit?: { message?: string; author?: { date?: string } };
    }>;
    const c = arr[0]?.commit;
    const message = (c?.message ?? "").split("\n")[0]?.trim() ?? "";
    if (!message) return null;
    return { message, date: c?.author?.date ?? "" };
  } catch {
    return null;
  }
}
