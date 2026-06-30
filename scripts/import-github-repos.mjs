// Bulk-import every repo you own (private included) as a Crucible project, and ENRICH
// projects you already have (fill missing repo URL / description / play URL — never
// overwriting anything you've set).
//
//   pnpm import-repos:preview   # dry run — shows what would be added/enriched
//   pnpm import-repos           # apply
//
// Matching: by repo URL first (so a project whose repo differs from its name — e.g.
// "Wayfinders" → kalogan/project-mmo — is recognised, not duplicated), then by slug for
// existing projects that have no repo linked yet. New repos become new projects.
//
// Needs GITHUB_TOKEN (a PAT with repo read) + DATABASE_URL in .env.local. Idempotent.
// Forks + archived repos are skipped. Kind is inferred (game-ish → game, else app).
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

const norm = (u) => (u || "").toLowerCase().replace(/\/+$/, "");
const existing = (
  await c.query("select id, slug, repo_url, description, url from projects")
).rows;
const byRepo = new Map(existing.filter((p) => p.repo_url).map((p) => [norm(p.repo_url), p]));
const bySlug = new Map(existing.map((p) => [p.slug, p]));

let added = 0;
let enriched = 0;
let skipped = 0;
for (const repo of repos) {
  const slug = slugify(repo.name);
  if (!slug) {
    skipped++;
    continue;
  }
  const name = titleCase(repo.name);

  // 1) Already linked to this exact repo → enrich.
  // 2) Same slug + no repo linked yet → treat as the same project, link + enrich.
  let match = byRepo.get(norm(repo.html_url));
  if (!match) {
    const s = bySlug.get(slug);
    if (s && !s.repo_url) match = s;
    else if (s) {
      // Slug taken by a DIFFERENT repo'd project — don't touch it.
      skipped++;
      continue;
    }
  }

  if (match) {
    if (dry) {
      console.log(`would enrich ${(match.slug).padEnd(28)} ← ${repo.name}`);
    } else {
      // COALESCE: fill only what's currently empty; never overwrite your values.
      await c.query(
        `update projects set
           repo_url = coalesce(repo_url, $1),
           description = coalesce(nullif(description, ''), $2),
           url = coalesce(nullif(url, ''), $3)
         where id = $4`,
        [repo.html_url, repo.description || null, repo.homepage || null, match.id],
      );
      console.log(`enriched     ${(match.slug).padEnd(28)} ← ${repo.name}`);
    }
    match.repo_url = match.repo_url || repo.html_url;
    enriched++;
    continue;
  }

  // New project.
  const kind = inferKind(repo);
  if (dry) {
    console.log(`would add    ${name.padEnd(28)} [${kind}]`);
  } else {
    await c.query(
      `insert into projects (slug, name, kind, status, repo_url, url, description)
       values ($1,$2,$3,'prototype',$4,$5,$6) on conflict (slug) do nothing`,
      [slug, name, kind, repo.html_url, repo.homepage || null, repo.description || null],
    );
    console.log(`added        ${name.padEnd(28)} [${kind}]`);
  }
  bySlug.set(slug, { slug, repo_url: repo.html_url });
  byRepo.set(norm(repo.html_url), { slug });
  added++;
}
await c.end();
console.log(
  `\n${dry ? "(dry run) " : ""}${added} added, ${enriched} enriched, ${skipped} skipped (slug taken by another project).`,
);
