import "server-only";

export interface RepoInfo {
  /** GitHub `pushed_at` (repo last updated upstream), or null. */
  pushedAt: string | null;
  /** Tech derived from the primary language + framework topics. */
  tech: string[];
  /** Genres derived from genre-ish topics. */
  genres: string[];
}

// GitHub topics → a clean Tech label.
const TECH_TOPIC: Record<string, string> = {
  threejs: "Three.js",
  "three-js": "Three.js",
  three: "Three.js",
  "react-three-fiber": "React Three Fiber",
  r3f: "React Three Fiber",
  react: "React",
  nextjs: "Next.js",
  "next-js": "Next.js",
  next: "Next.js",
  typescript: "TypeScript",
  javascript: "JavaScript",
  roblox: "Roblox",
  "roblox-studio": "Roblox",
  luau: "Luau",
  lua: "Lua",
  webgl: "WebGL",
  vite: "Vite",
  supabase: "Supabase",
  nodejs: "Node.js",
  node: "Node.js",
  python: "Python",
  tailwind: "Tailwind",
  tailwindcss: "Tailwind",
  godot: "Godot",
  unity: "Unity",
  svelte: "Svelte",
  vue: "Vue",
  postgres: "Postgres",
  postgresql: "Postgres",
  colyseus: "Colyseus",
};

// GitHub topics → a clean Genre label.
const GENRE_TOPIC: Record<string, string> = {
  mmo: "MMO",
  mmorpg: "MMORPG",
  rpg: "RPG",
  fps: "FPS",
  adventure: "Adventure",
  puzzle: "Puzzle",
  platformer: "Platformer",
  strategy: "Strategy",
  roguelike: "Roguelike",
  simulation: "Simulation",
  sandbox: "Sandbox",
  social: "Social",
  multiplayer: "Multiplayer",
  finance: "Finance",
  fintech: "Finance",
  health: "Health",
  healthcare: "Health",
  education: "Education",
  visualizer: "Visualizer",
  visualization: "Visualizer",
  dataviz: "Visualizer",
  "data-visualization": "Visualizer",
  productivity: "Productivity",
  hockey: "Sports",
  sports: "Sports",
};

/**
 * Fetch a repo's `pushed_at` + auto-derived tech/genres (from its primary language +
 * topics) in ONE cached call (30 min). Best-effort: returns empties on any failure.
 * Unmatched topics are dropped to keep suggestions clean. GITHUB_TOKEN lifts rate limits.
 */
export async function fetchRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "crucible-asset-studio",
    "x-github-api-version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
      next: { revalidate: 1800 },
    });
    if (!res.ok) return { pushedAt: null, tech: [], genres: [] };
    const j = (await res.json()) as {
      pushed_at?: string;
      language?: string | null;
      topics?: string[];
    };

    const tech: string[] = [];
    const genres: string[] = [];
    const add = (list: string[], v: string): void => {
      if (v && !list.includes(v)) list.push(v);
    };

    if (j.language) add(tech, j.language); // primary language as-is (TypeScript, Lua, …)
    for (const topic of j.topics ?? []) {
      const key = topic.toLowerCase();
      if (GENRE_TOPIC[key]) add(genres, GENRE_TOPIC[key]);
      else if (TECH_TOPIC[key]) add(tech, TECH_TOPIC[key]);
    }

    return { pushedAt: j.pushed_at ?? null, tech, genres };
  } catch {
    return { pushedAt: null, tech: [], genres: [] };
  }
}
