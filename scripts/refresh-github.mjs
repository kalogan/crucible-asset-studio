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
  await c.query(
    `update projects set
       github_pushed_at = $1,
       tech = case when coalesce(array_length(tech, 1), 0) = 0 then $2::text[] else tech end,
       genres = case when coalesce(array_length(genres, 1), 0) = 0 then $3::text[] else genres end,
       description = coalesce(nullif(description, ''), $4),
       url = coalesce(nullif(url, ''), $5)
     where id = $6`,
    [repo.pushed_at || null, tech, genres, repo.description || null, repo.homepage || null, p.id],
  );
  console.log(`ok     ${p.slug.padEnd(28)} ${[...tech, ...genres].join(", ") || "(no tags)"}`);
  ok++;
}
await c.end();
console.log(`\nRefreshed ${ok}, skipped ${failed}.`);
