# HANDOFF: Kit Registry & Project Map

**Version:** v2 (supersedes `HANDOFF_pattern_registry.md` v1 — the "pattern" vocabulary is retired in favor of the tools/kits/systems hierarchy)
**Owner:** Kevin (single-user, forever — not a team tool, not a product)
**Runs on:** the always-on mini PC (headless Linux, reached via Tailscale) — same box as the agent swarm and Asset Forge pipeline
**Intended consumer:** a Claude Code session building this incrementally

---

## 0. TL;DR / Intent

A **personal, code-first reuse system** built on one abstraction: a three-tier composition hierarchy where **dependencies only ever point down**.

- **Tools → Kits → Systems.** Tools are atoms; kits compose tools into drop-in capabilities; systems compose kits into domains. A tool never imports a kit; a kit never imports a system.
- Units enter the registry **Claude-assisted**: point Claude Code at proven working code → it emits a unit at the right tier.
- Each unit is **distributed** one of two ways (orthogonal to its tier): **stamped** (scaffolded in as a copy, then diverges freely) or **linked** (a versioned dependency that stays canonical everywhere).
- A **read-only dashboard** renders the resulting **dependency graph** across all projects (which systems use which kits use which tools, and which projects use what) and acts as the launcher for scaffolding. It visualizes and triggers — it is never an editor.

The problem this solves: *"I have useful capabilities sprinkled across projects (GLB viewer in Asset Forge, preview harness in Wayfinders, the executor-adapter, …) and no way to see them, reuse them consistently, or remember where they are."*

---

## 1. Non-Goals (read first — these are the tar pits)

- **NOT an IDE.** No editing code in this tool. You generate code into projects, then edit them in Claude Code. Editing was never the want; reuse was.
- **NOT a fourth tier.** Three tiers is the ceiling. If a unit's tier is ambiguous, call it a kit and move on. Don't add "modules," "packages," "features" as new levels.
- **NOT a sync engine.** Stamped units diverge freely — no update propagation, no "you're N versions behind" nudges. Linked units stay consistent via the **package manager**, which already *is* the sync system. Never build one.
- **NOT multi-user.** Just you. No auth, no RLS, no sharing.
- **NOT a custom generation engine.** Plain template dirs + string substitution. The value is your accumulated units, not a clever engine.
- **NOT heavy monorepo tooling.** pnpm/npm **workspaces only**. No Nx/Turborepo until a slow build genuinely hurts.
- **The dashboard NEVER becomes editable** and **NEVER hand-maintained** — it derives itself by scanning. The moment it grows an editor or a manual state file, it's the tar pit.
- The framework is **descriptive, not bureaucratic** — a way to file what you already have, not a mandate to classify every function.

---

## 2. The Core Abstraction: composition hierarchy

Each tier is defined by **what it composes** and **what it does**. Dependencies point down only — this single rule is the framework.

| Tier | What it is | Composes | Test |
|------|-----------|----------|------|
| **Tool** | An atom. One focused responsibility (a fn, hook, or single widget). Generic, domain-agnostic, max reuse. | nothing (just external libs) | "is this one thing?" |
| **Kit** | A capability. Bundles tools + UI + integration surface into a drop-in feature that works once its vars are filled. | tools (lightly, other kits) | "does this hand an app a whole capability on drop-in?" |
| **System** | A domain. Orchestrates kits + domain logic + rules + state into a coherent subsystem. Domain-bound, least reusable, most valuable. | kits (+ tools directly) + orchestration | "does this carry domain rules and coordinate multiple kits?" |

**Seed examples (from existing work):**
- Tools: GLB loader, orbit-controls hook, Supabase-upload util, placeholder-substitution fn, seeded RNG, cost-estimator.
- Kits: GLB viewer, file-upload, auth, review-gallery, executor-adapter.
- Systems: procedural kitbashing, Asset Forge batch pipeline, Wayfinders preview harness, the kit-registry itself.

**Invariants:** reusability increases going down; domain-specificity increases going up; you can swap a tool inside a kit without touching the system above it.

---

## 3. The Second Axis: distribution (orthogonal to tier)

Every unit is distributed one of two ways, independent of its tier:

- **Stamped** — the scaffold action copies the unit's template into a target project; after that the copy and the registry **diverge freely**. For things each app customizes.
- **Linked** — the unit is a real versioned package the app **depends on**, staying identical everywhere; updates are opt-in per app. For "same everywhere, drift is bad."

**The two axes correlate predictably** (use as a default, not a law):

| Tier | Tends toward | Why |
|------|-------------|-----|
| Tool | **Linked** | tiny, generic, your stdlib — keep canonical |
| Kit | **Split** | stable (GLB viewer) → linked; customizable (auth) → stamped |
| System | **Stamped** | domain-heavy, grows per-project — scaffold skeleton, diverge — but *consumes* linked kits/tools internally |

Rule of thumb: **higher tier → more stamped; lower tier → more linked.**

---

## 4. Home Base: the kits monorepo

One git repo authors all units together (pnpm/npm workspaces). Three folders mirror the tiers:

```
~/kit-registry/                 # the monorepo (git-versioned)
  packages/
    tools/
      glb-loader/
      upload-util/
      seeded-rng/
    kits/
      glb-viewer/
      auth/
      review-gallery/
      executor-adapter/
    systems/
      kitbashing/               # template for stamping
      asset-pipeline/           # template for stamping
  EXTRACT.md                    # reusable Claude-assisted extraction prompt
  config.json                   # scan roots for the dashboard
```

- **Authoring** happens here, together, with workspace cross-references (a system imports a kit as a normal workspace dep; a kit imports tools).
- **Distribution** is layered on top (§5) — the monorepo is *where units live*, not *how apps consume them*. Your apps are separate repos and pull units out.

---

## 5. Distribution mechanics

**Linked units (tools, stable kits):**
1. Start simple — **git-based npm deps** (`npm install git+…/glb-viewer#v1.2.0`), zero infra.
2. Upgrade to **Verdaccio (private npm registry) on the mini PC** once you have several linked units → clean `npm install @kev/glb-viewer`, proper semver, reachable over Tailscale. Same box as the swarm + Asset Forge.
- Apps import them; they stay canonical; updates are opt-in.

**Stamped units (systems, customizable kits):**
- The **scaffold action** copies the unit's `template/` into the target project, substitutes `__placeholders__`, and writes a breadcrumb (§7).
- After stamping, the copy is just that project's code — diverges freely, no obligation back to the registry.

A unit's `manifest.json` declares which mode it uses (`distribution: "linked" | "stamped"`).

---

## 6. Unit anatomy & manifest

Every unit (any tier) has the same shape:

```
<unit>/
  src/ or template/   # linked units ship src/ ; stamped units ship template/ with __placeholders__
  variables.json      # stamped only: placeholders + defaults + descriptions
  manifest.json       # tier + composition + distribution metadata
  README.md           # what it is, source project, gotchas
```

**`manifest.json`** — the framework encoded as metadata. The two load-bearing fields are `tier` and `composes`:

```json
{
  "name": "glb-viewer",
  "tier": "kit",
  "composes": ["glb-loader", "orbit-controls"],
  "distribution": "linked",
  "version": "1.2.0",
  "tags": ["three.js", "3d", "viewer"],
  "stack": ["react", "three"],
  "source": "asset-forge",
  "description": "Three.js GLB viewer with orbit controls + Supabase load"
}
```

- A **tool** has `composes: []`. A **kit** composes tools. A **system** composes kits. That's the whole hierarchy, declared.
- The dashboard reads `tier` + `composes` to build the graph (§8).

**Stamped `variables.json`** (string substitution, no engine; recommend `__var__` placeholder syntax):
```json
{
  "componentName": { "default": "GLBViewer",    "desc": "Exported component name" },
  "storageBucket": { "default": "assets",       "desc": "Supabase bucket for GLBs" }
}
```

---

## 7. Claude-assisted extraction (the make-or-break workflow)

Generation is easy; **extraction** (turning working code into a reusable unit) is what kills these tools when it's manual. Here it's a bounded, repeatable Claude Code task. Keep this as `EXTRACT.md`:

> **Extraction prompt (reusable):**
> "Read `<path to working code in project X>`. Decide its tier:
> - **tool** = one focused responsibility, composes nothing;
> - **kit** = tools + UI bundled into a drop-in capability;
> - **system** = orchestrates multiple kits with domain logic.
> Create the unit in `~/kit-registry/packages/<tier>s/<name>/` with:
> 1. `src/` (if it'll be **linked**) or `template/` with `__placeholder__` tokens for every project-specific value (if it'll be **stamped**).
> 2. `variables.json` (stamped only) — each placeholder, default, one-line description.
> 3. `manifest.json` — `name`, `tier`, `composes` (the units one tier down that it depends on), `distribution`, `version` 1.0.0, tags, stack, source, description.
> 4. `README.md` — what it does, source project, gotchas.
> When unsure whether something is project-specific, make it a variable and note it. Dependencies must point DOWN only — a kit may list tools in `composes`, never a system."

**First extractions (prove the loop end-to-end before the dashboard exists):**
- `glb-viewer` (kit, linked) — from Asset Forge
- `executor-adapter` (kit) — from the Asset Forge pipeline
- `preview-harness` (likely a **system**, stamped) — from Wayfinders
- a couple of tools the above depend on (e.g. `glb-loader`, `upload-util`) — proves `composes` wiring

---

## 8. Dashboard (read-only, self-deriving, graph-first)

A small local React app (Vite) + a thin Node scanner. Runs on the mini PC; viewed over Tailscale.

**The scanner** walks the projects in `config.json` and, per project, derives:
- `package.json` deps → **linked** units in use (+ their shared version)
- `.kits` breadcrumb (§9) → **stamped** units in use (+ vars)
- the registry's manifests → each unit's `tier` + `composes`
- git → branch, last-commit date (coarse activity)
Output: a generated `projects.json` + `graph.json` (a cache, not a maintained source of truth). Re-scan on demand.

**The UI** (read-only):
- **Project map** — a card per project: phase, stack, the units it uses, activity.
- **Composition graph** — the payoff. Because every unit declares `tier` + `composes`, render the actual tree: *system → kits → tools*. Three-tier layout (systems top, kits middle, tools bottom), edges = `composes`.
- **Reverse index** — pick any unit, see every project (and unit) that uses it: "glb-loader → used by 4 kits across 6 projects." This is the view that makes your sprinkled capabilities visible.
- **Launcher** — from a project card, "scaffold a unit here" → runs the §5 stamped action. The only write path in the whole dashboard.

No editing, no inline config, no project-creation flows in v1.

---

## 9. The breadcrumb (links scaffold → dashboard with zero bookkeeping)

Every **stamped** scaffold writes/updates a `.kits` file in the target project root:

```json
{
  "stamped": [
    { "unit": "auth", "tier": "kit", "version": "1.0.0", "at": "2026-06-28", "vars": { "provider": "supabase" } }
  ]
}
```

Linked units need no breadcrumb — they're already in `package.json`. The dashboard merges both reads (package.json for linked, `.kits` for stamped) into one picture. The scaffold action is the only writer of `.kits`; nothing is hand-maintained.

---

## 10. Prioritized Build Order

The map is worthless until units exist, so the registry comes first — non-negotiable.

**Phase 1 — Registry + Scaffold (the value core)**
1. Stand up the `~/kit-registry` monorepo (pnpm/npm workspaces) with `packages/{tools,kits,systems}/`.
2. Lock conventions: `manifest.json` schema (`tier`, `composes`, `distribution`), `variables.json`, placeholder syntax, README.
3. Build the scaffold CLI for **stamped** units: resolve vars, substitute in contents + filenames, overwrite policy (skip-with-warning default, `--force`), write `.kits` breadcrumb.
4. Seed via extraction (§7): `glb-viewer`, `executor-adapter`, `preview-harness`, + 2 tools. Verify `composes` wiring and a clean stamp into a throwaway project.
5. Save `EXTRACT.md`.

**Phase 2 — Linked distribution**
6. Start with git-based deps for the linked units (`glb-viewer`, tools). Confirm an app can import and stay canonical.
7. (When several linked units exist) stand up **Verdaccio** on the mini PC; republish; switch apps to `@kev/*` installs.

**Phase 3 — Dashboard (the cognition layer)**
8. Scanner → `projects.json` + `graph.json` (package.json + `.kits` + registry manifests + git).
9. React project map (cards).
10. Composition graph (system → kits → tools).
11. Reverse index (unit → projects/units using it).
12. Launcher → triggers the stamped scaffold.

**Phase 4 — Polish (resist over-investing)**
13. Search/filter, rendered READMEs, phase markers, re-scan button.

---

## 11. Reality Checks & Known-Hard Bits

- **Tier is earned, not pre-assigned.** A tool that accretes UI + state → promote to kit; a kit that accretes domain logic + orchestrates other kits → promote to system. Extraction's first question is always "what tier?"
- **Phase resists auto-derivation.** Git gives *activity*, not *phase*. If you want true phase, accept a one-line `.project.json` per project. If even that rots, fall back to a git-activity heuristic and drop phase. Don't build a phase system.
- **Keep the engine boring.** String substitution over a template dir. If one unit genuinely needs more, adopt Plop for *that unit only* — don't rewrite the registry around it.
- **Divergence is a feature** for stamped units. No "behind the registry" warnings — that's the sync tar pit sneaking back.
- **Enforce only one rule strictly:** dependencies point down. Everything else is descriptive convenience.

---

## 12. Open Decisions (resolve in-session)

- **Verdaccio now or later:** git-based deps first (recommended) vs. stand up Verdaccio immediately.
- **Placeholder syntax:** confirm `__var__` vs `{{var}}` — pick one, document once.
- **Phase detection:** `.project.json` marker vs git-activity heuristic vs skip for v1.
- **Scan roots:** single projects dir vs configurable list in `config.json`.
- **Overwrite default:** skip-with-warning (recommended) vs prompt-per-file.
- **Monorepo manager:** pnpm workspaces (recommended for disk-efficient linking) vs npm workspaces.
```
