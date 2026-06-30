// Bulk-import every repo you own (private included) as a Crucible project.
//
//   pnpm import-repos:preview   # dry run — shows what WOULD be added
//   pnpm import-repos           # actually inserts them
//
// Needs GITHUB_TOKEN (a PAT with repo read) + DATABASE_URL in .env.local. Idempotent:
// existing slugs are skipped, so re-running only adds new repos. Forks + archived repos
// are skipped. Kind is inferred (game-ish topics/langs → game, else app) — edit later.
import pg from "pg";

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("Set GITHUB_TOKEN (a PAT with repo read) in .env.local first.");
  process.exit(1);
}
const dry = process.argv.includes("--dry");

const headers = {
  authorization: `Bearer ${token}`,
  accept: "application/vnd.github+json",
  "user-agent": "crucible-asset-studio",
  "x-github-api-version": "2022-11-28",
};

const titleCase = (s) =>
  s.split(/[-_ ]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

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
const existing = new Set((await c.query("select slug from projects")).rows.map((r) => r.slug));

let added = 0;
let skipped = 0;
for (const repo of repos) {
  const slug = slugify(repo.name);
  if (!slug || existing.has(slug)) {
    skipped++;
    continue;
  }
  const kind = inferKind(repo);
  const name = titleCase(repo.name);
  if (dry) {
    console.log(`would add  ${name.padEnd(28)} [${kind}]`);
  } else {
    await c.query(
      `insert into projects (slug, name, kind, status, repo_url, url, description)
       values ($1,$2,$3,'prototype',$4,$5,$6) on conflict (slug) do nothing`,
      [slug, name, kind, repo.html_url, repo.homepage || null, repo.description || null],
    );
    console.log(`added      ${name.padEnd(28)} [${kind}]`);
  }
  existing.add(slug);
  added++;
}
await c.end();
console.log(`\n${dry ? "(dry run) " : ""}${added} ${dry ? "would be " : ""}added, ${skipped} already existed.`);
