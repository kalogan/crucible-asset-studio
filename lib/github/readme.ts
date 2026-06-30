import "server-only";

/**
 * Condense a repo's README into a one-paragraph plain-text blurb (the first real prose,
 * with markdown/badges/headings stripped). Cached 30 min, best-effort (null on failure).
 */
export async function fetchReadmeExcerpt(owner: string, repo: string): Promise<string | null> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github.raw",
    "user-agent": "crucible-asset-studio",
    "x-github-api-version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers,
      next: { revalidate: 1800 },
    });
    if (!res.ok) return null;
    return synthesize(await res.text());
  } catch {
    return null;
  }
}

/** First substantive prose paragraph of a README, markdown stripped, ~280 chars. */
function synthesize(md: string): string | null {
  const out: string[] = [];
  let started = false;
  for (const raw of md.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line) {
      if (started) break; // a blank line ends the first paragraph
      continue;
    }
    if (
      line.startsWith("#") || // heading
      line.startsWith("```") || // code fence
      line.startsWith(">") || // blockquote
      line.startsWith("<") || // raw HTML (badges, divs)
      line.startsWith("![") || // image
      line.startsWith("[![") || // linked badge
      line.startsWith("|") || // table
      line.startsWith("---") // hr
    ) {
      if (started) break;
      continue;
    }
    line = line
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → text
      .replace(/[*_`]/g, "") // emphasis / inline code
      .trim();
    if (!line) continue;
    out.push(line);
    started = true;
    if (out.join(" ").length > 280) break;
  }
  const text = out.join(" ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > 280 ? `${text.slice(0, 277).trimEnd()}…` : text;
}
