// Import SELECTED repos you own as Crucible projects, and ENRICH projects you already
// have (fill missing repo URL / description / play URL — never overwriting your values).
//
//   pnpm import-repos:preview   # dry run — lists what's enrichable / addable
//   pnpm import-repos           # enriches existing, then PROMPTS which new repos to add
//   pnpm import-repos:all       # add every new repo (no prompt)
//
// Matching: by repo URL first (so a project whose repo differs from its name — e.g.
// "Wayfinders" → kalogan/project-mmo — is recognised, not duplicated), then by slug for
// existing projects with no repo linked yet.
//
// Needs GITHUB_TOKEN (a PAT with repo read) + DATABASE_URL in .env.local. Idempotent.
// Forks + archived repos are skipped. Kind is inferred (game-ish → game, else app).
import pg from "pg";
import { createInterface } from "node:readline/promises";

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("Set GITHUB_TOKEN (a PAT with repo read) in .env.local first.");
  process.exit(1);
}
const dry = process.argv.includes("--dry");
const all = process.argv.includes("--all");

const headers = {
  authorization: `Bearer ${token}`,
  accept: "application/vnd.github+json",
  "user-agent": "crucible-asset-studio",
  "x-github-api-version": "2022-11-28",
};

const titleCase = (s) =>
  s.split(/[-_ ]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const norm = (u) => (u || "").toLowerCase().replace(/\/+$/, "");

const GAME_TOPICS = new Set([
  "game", "games", "gamedev", "threejs", "three-js", "r3f", "react-three-fiber",
  "roblox", "mmo", "mmorpg", "fps", "rpg", "unity", "godot", "webgl", "phaser",
]);
function inferKind(repo) {
  const topics = (repo.topics ?? []).map((t) => t.toLowerCase());
  if (topics.some((t) => GAME_TOPICS.has(t))) return "game";
  const lang = (repo.language ?? "").toLowerCase();
  if (lang === "gdscript" || lang === "luau") return "game";
  return "app";
}

async function fetchAllRepos() {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(
      `https://api.github.com/user/repos?per_page=100&affiliation=owner&sort=updated&page=${page}`,
      { headers },
    );
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const arr = await res.json();
    out.push(...arr);
    if (arr.length < 100) break;
  }
  return out;
}

const repos = (await fetchAllRepos()).filter((r) => !r.fork && !r.archived);
console.log(`Found ${repos.length} owned repos (non-fork, non-archived).\n`);

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const existing = (
  await c.query("select id, slug, repo_url, description, url from projects")
).rows;
const byRepo = new Map(existing.filter((p) => p.repo_url).map((p) => [norm(p.repo_url), p]));
const bySlug = new Map(existing.map((p) => [p.slug, p]));

// Classify: enrich an existing project, add a new one, or skip (slug clash).
const enrichTasks = [];
const addCandidates = [];
for (const repo of repos) {
  const slug = slugify(repo.name);
  if (!slug) continue;
  let match = byRepo.get(norm(repo.html_url));
  if (!match) {
    const s = bySlug.get(slug);
    if (s && !s.repo_url) match = s;
    else if (s) continue; // slug taken by a different repo'd project — leave it
  }
  if (match) enrichTasks.push({ match, repo });
  else addCandidates.push({ slug, repo });
}

if (dry) {
  for (const { match, repo } of enrichTasks)
    console.log(`would enrich  ${match.slug.padEnd(30)} ← ${repo.name}`);
  for (const { repo } of addCandidates)
    console.log(`would add     ${titleCase(repo.name).padEnd(30)} [${inferKind(repo)}]`);
  console.log(
    `\n(dry run) ${addCandidates.length} addable, ${enrichTasks.length} enrichable. ` +
      `Run \`pnpm import-repos\` to pick which to add.`,
  );
  await c.end();
  process.exit(0);
}

// Enrich existing projects (fill blanks only) — always safe.
for (const { match, repo } of enrichTasks) {
  await c.query(
    `update projects set
       repo_url = coalesce(repo_url, $1),
       description = coalesce(nullif(description, ''), $2),
       url = coalesce(nullif(url, ''), $3)
     where id = $4`,
    [repo.html_url, repo.description || null, repo.homepage || null, match.id],
  );
  console.log(`enriched   ${match.slug}`);
}

// Choose which NEW repos to add.
let chosen = [];
if (addCandidates.length === 0) {
  console.log("\nNo new repos to add.");
} else if (all) {
  chosen = addCandidates;
} else {
  console.log("\nNew repos you could add:");
  addCandidates.forEach((cand, i) =>
    console.log(
      `  ${String(i + 1).padStart(2)}. ${titleCase(cand.repo.name).padEnd(28)} [${inferKind(cand.repo)}]  ${cand.repo.html_url}`,
    ),
  );
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ans = (await rl.question("\nAdd which? (e.g. 1,3,5 or 1-4, 'all', 'none'): "))
    .trim()
    .toLowerCase();
  rl.close();
  if (ans === "all") {
    chosen = addCandidates;
  } else if (ans && ans !== "none") {
    const idx = new Set();
    for (const part of ans.split(/[\s,]+/)) {
      const range = part.match(/^(\d+)-(\d+)$/);
      if (range) for (let n = +range[1]; n <= +range[2]; n++) idx.add(n);
      else if (/^\d+$/.test(part)) idx.add(+part);
    }
    chosen = addCandidates.filter((_, i) => idx.has(i + 1));
  }
}

for (const { slug, repo } of chosen) {
  await c.query(
    `insert into projects (slug, name, kind, status, repo_url, url, description)
     values ($1,$2,$3,'prototype',$4,$5,$6) on conflict (slug) do nothing`,
    [slug, titleCase(repo.name), inferKind(repo), repo.html_url, repo.homepage || null, repo.description || null],
  );
  console.log(`added      ${titleCase(repo.name)}`);
}

await c.end();
console.log(`\nDone: ${chosen.length} added, ${enrichTasks.length} enriched.`);
