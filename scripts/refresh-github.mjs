// Refresh GitHub data into the DB for EVERY project that has a repo linked: stores the
// repo's last-update (github_pushed_at) + fills tech/genres/description/play-URL when empty.
// The dashboard then reads this from the DB — no live GitHub fetch on render, no server
// token needed. Run whenever you want fresh data:
//
//   pnpm refresh-github
//
// Needs GITHUB_TOKEN (read access to your private repos) + DATABASE_URL in .env.local.
import pg from "pg";

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("Set GITHUB_TOKEN (a PAT with repo read) in .env.local first.");
  process.exit(1);
}
const base = {
  accept: "application/vnd.github+json",
  "user-agent": "crucible-asset-studio",
  "x-github-api-version": "2022-11-28",
};
const headers = { ...base, authorization: `Bearer ${token}` };

// Try authenticated (reaches your private repos), then fall back to unauthenticated for
// PUBLIC repos the token can't use (e.g. a different account's repo → 401 with your token).
async function ghRepo(owner, repo) {
  let res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!res.ok && [401, 403, 404].includes(res.status)) {
    const pub = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: base });
    if (pub.ok) return pub;
  }
  return res;
}

// Fetch + synthesize the README into a one-paragraph blurb (first prose, markdown stripped).
async function ghReadmeBlurb(owner, repo) {
  const raw = { ...headers, accept: "application/vnd.github.raw" };
  let res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers: raw });
  if (!res.ok && [401, 403, 404].includes(res.status)) {
    res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers: { ...base, accept: "application/vnd.github.raw" },
    });
  }
  if (!res.ok) return null;
  return synthesize(await res.text());
}

// Total commits on the default branch. We request 1 commit/page and read the `last` page
// number from the Link header — that page number IS the commit count (one extra API call).
async function ghCommitCount(owner, repo, branch) {
  const q = `per_page=1${branch ? `&sha=${encodeURIComponent(branch)}` : ""}`;
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?${q}`;
  let res = await fetch(url, { headers });
  if (!res.ok && [401, 403, 404].includes(res.status)) {
    const pub = await fetch(url, { headers: base });
    if (pub.ok) res = pub;
  }
  if (!res.ok) return null;
  const link = res.headers.get("link");
  const m = link?.match(/[?&]page=(\d+)>;\s*rel="last"/);
  if (m) return Number(m[1]);
  // No "last" link → a single page: 1 commit if the array is non-empty, else 0 (empty repo).
  const arr = await res.json().catch(() => []);
  return Array.isArray(arr) ? arr.length : null;
}

function synthesize(md) {
  const out = [];
  let started = false;
  for (const r of md.split(/\r?\n/)) {
    let line = r.trim();
    if (!line) {
      if (started) break;
      continue;
    }
    if (/^(#|```|>|<|!\[|\[!\[|\||---)/.test(line)) {
      if (started) break;
      continue;
    }
    line = line
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`]/g, "")
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

const TECH_TOPIC = {
  threejs: "Three.js", "three-js": "Three.js", three: "Three.js",
  "react-three-fiber": "React Three Fiber", r3f: "React Three Fiber",
  react: "React", nextjs: "Next.js", "next-js": "Next.js", next: "Next.js",
  typescript: "TypeScript", javascript: "JavaScript", roblox: "Roblox",
  "roblox-studio": "Roblox", luau: "Luau", lua: "Lua", webgl: "WebGL",
  vite: "Vite", supabase: "Supabase", nodejs: "Node.js", node: "Node.js",
  python: "Python", tailwind: "Tailwind", tailwindcss: "Tailwind",
  godot: "Godot", unity: "Unity", svelte: "Svelte", vue: "Vue",
  postgres: "Postgres", postgresql: "Postgres", colyseus: "Colyseus",
};
const GENRE_TOPIC = {
  mmo: "MMO", mmorpg: "MMORPG", rpg: "RPG", fps: "FPS", adventure: "Adventure",
  puzzle: "Puzzle", platformer: "Platformer", strategy: "Strategy",
  roguelike: "Roguelike", simulation: "Simulation", sandbox: "Sandbox",
  social: "Social", multiplayer: "Multiplayer", finance: "Finance",
  fintech: "Finance", health: "Health", healthcare: "Health",
  education: "Education", visualizer: "Visualizer", visualization: "Visualizer",
  dataviz: "Visualizer", "data-visualization": "Visualizer",
  productivity: "Productivity", hockey: "Sports", sports: "Sports",
};
function deriveTags(repo) {
  const tech = [];
  const genres = [];
  const add = (l, v) => {
    if (v && !l.includes(v)) l.push(v);
  };
  if (repo.language) add(tech, repo.language);
  for (const t of repo.topics ?? []) {
    const k = t.toLowerCase();
    if (GENRE_TOPIC[k]) add(genres, GENRE_TOPIC[k]);
    else if (TECH_TOPIC[k]) add(tech, TECH_TOPIC[k]);
  }
  return { tech, genres };
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const rows = (
  await c.query("select id, slug, repo_url from projects where repo_url is not null and repo_url <> '' order by created_at")
).rows;

let ok = 0;
let failed = 0;
for (const p of rows) {
  const m = p.repo_url.match(/github\.com[/:]+([^/]+)\/([^/#?]+?)(?:\.git)?\/?$/i);
  if (!m) {
    console.log(`skip   ${p.slug} (unparsed repo_url)`);
    failed++;
    continue;
  }
  const res = await ghRepo(m[1], m[2]);
  if (!res.ok) {
    const hint =
      res.status === 404
        ? "private + token has no access — widen the token to ALL repos"
        : res.status === 401
          ? "bad credentials for this owner"
          : "";
    console.log(`skip   ${p.slug.padEnd(28)} HTTP ${res.status} ${m[1]}/${m[2]} ${hint && `(${hint})`}`);
    failed++;
    continue;
  }
  const repo = await res.json();
  const { tech, genres } = deriveTags(repo);
  const blurb = await ghReadmeBlurb(m[1], m[2]);
  const commits = await ghCommitCount(m[1], m[2], repo.default_branch);
  await c.query(
    `update projects set
       github_pushed_at = $1,
       tech = case when coalesce(array_length(tech, 1), 0) = 0 then $2::text[] else tech end,
       genres = case when coalesce(array_length(genres, 1), 0) = 0 then $3::text[] else genres end,
       description = coalesce(nullif(description, ''), $4),
       url = coalesce(nullif(url, ''), $5),
       summary = coalesce($6, summary),
       commit_count = coalesce($7, commit_count)
     where id = $8`,
    [repo.pushed_at || null, tech, genres, repo.description || null, repo.homepage || null, blurb, commits, p.id],
  );
  console.log(`ok     ${p.slug.padEnd(28)} ${commits ?? "?"} commits · ${[...tech, ...genres].join(", ") || "(no tags)"}${blurb ? " +readme" : ""}`);
  ok++;
}
await c.end();
console.log(`\nRefreshed ${ok}, skipped ${failed}.`);
