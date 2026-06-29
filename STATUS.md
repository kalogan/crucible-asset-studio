# Crucible — build status

_Durable status for the Architect/Builder pipeline (write → persist → notify)._

## Where we are

**Phase 0 — kernel mining:** ✅ done (`KERNEL_LESSONS.md`).
**Phase 1 — platform spine:** ✅ done. Supabase live; generated real Wooden Barrel + Palm Tree
GLBs end-to-end. Cost guardrails, live status stepper, GLB viewer (IBL).
**Phase 2 — canon engine:** ✅ canon-first done. Wayfinders canon auto-drafted from the art
bible (Anthropic key in `.env.local`), wired into generation (prompt scaffolding), precision gate,
canon panel + intake. **2D-review-before-3D**: choose Image-only (~$0.003) vs Straight-to-3D
(~$0.09); promote a reviewed image to 3D on demand. Canon-aware enrichment (subject-only) so it
stops fighting the canon. Migrations 0001-0004 applied. 59 tests green.
**Phase 2 remaining — the LoRA slice** (Replicate, two paths per CANON_INTAKE §5): the real
style-fidelity lever. Prompt scaffolding only *approximates* the faceted low-poly look; the trained
LoRA *enforces* it. Path A needs a turntable-render dataset of the game's faceted assets.

| Slice | What | Commit |
|---|---|---|
| S0 | Next.js + TS scaffold, strict, Tailwind, ESLint+a11y, Vitest, Supabase clients | `74ab20c` |
| S1 | Multi-game schema (6 tables) + Zod mirrors + server-only DAL + golden fixtures | `a5a2b51` |
| S3 | Executor-adapter (Replicate/TRELLIS kernel: routing, null-strip, 429-backoff, poll, persist) | `42aaccd` |
| S4 | Accessible GLB review viewer (r3f + drei) | `d576ab0` |
| S2 | Project switcher (create/select, cookie-backed active project) | `9d43079` |
| S5 | 2D→3D vertical slice → `in_review` + review queue (approve/reject) | `fb33562` |
| — | Cost guardrails (daily cap, single-in-flight, cancel-on-timeout) | `9410db3` |
| — | Live generation status stepper; viewer IBL fix | `5f0b8c4`, `e908503` |
| P2-core | Canon engine: scaffolding wired into generation + precision gate | `cc4e0b8` |
| P2-ui | Canon panel + intake flow (parallel builders) | `c57837d` |
| — | 2D-review-before-3D + canon-aware enrichment | `c796f23` |

**Last green gate:** typecheck 0 · lint 0 · **test 75** · build 0. Routes: `/`, `/generate`, `/review`, `/canon`, `/intake`, `/prompts`, `/library`, `/projects/[slug]`, `/projects/new`, `/api/import`.
**Live:** Supabase connected (`.env.local`), migrations 0001–0004 applied (`pnpm migrate`, idempotent), Anthropic + Replicate keys in. Wayfinders canon auto-drafted + active.

## How to run

`pnpm dev` → http://localhost:3000. Generate → pick **Image only** (~$0.003, review first) or **Straight to 3D** (~$0.09). ⚠️ Generation spends real money (Replicate); the Replicate dashboard spend limit + the in-app daily cap (`CRUCIBLE_DAILY_COST_CAP`, default $5) are the backstops.

## Known boundaries / follow-ups

- **Verify the TRELLIS version hash** (`lib/executor/models.ts`) against Replicate before trusting 3D output (KERNEL_LESSONS §1).
- **Generation is synchronous (~2 min/asset).** Fine locally; **prod/bulk needs the resumable batch worker — Phase 3** (Vercel function timeouts).
- **Don't run `pnpm build` while `next dev` is live** — it clobbers `.next` and 500s the dev server. Stop dev, gate, restart.

## Roadmap

### Up next — close the style-fidelity gap (the live problem)
Prompt scaffolding only *approximates* the faceted low-poly look — a "palm tree" still comes out as a
polished stylized render, not the game's chunky faceted style.

> **Reference to bring in (Kevin, next session):** the **Living Dungeon (March)** art bible/prompts
> scaffolded *really good* assets — Kevin will share screenshots + the exact prompt(s) used. Study its
> scaffolding structure and fold what worked into the canon engine. (March source incl. its
> `GAME_PROFILES`/`buildSystem*` prompts is local-only at `_reference/march-asset-forge/`.)

Three options, cheapest first:

1. **Harder low-poly prompt tweak** (free, ~$0.003 to test) — lead the canon `prompt_prefix` with
   stronger terms (`low-poly 3D game asset, untextured flat-shaded, hard faceted edges, blender low
   poly, isometric prop`). One cheap image test to see how far it moves. Band-aid, but free.
2. **Nano Banana (Gemini 2.5 Flash Image)** — add a Google adapter alongside FLUX in the executor
   registry. Has a **free tier**. Its superpower is **reference-image editing/consistency**: feed it
   shots of the game's faceted assets → "a palm in this style." That's the style-anchor lever
   (KERNEL_LESSONS §0) — potentially most of the fidelity for free, **a cheaper alternative/complement
   to the LoRA.** Try this before committing to the LoRA.
3. **The LoRA slice** (Replicate, Path A per `CANON_INTAKE.md` §5) — the real enforcer. Train on a
   **turntable-render dataset** of the game's actual faceted assets (~15–40 neutral shots/concept;
   prerequisite: get those renders out of the Wayfinders engine). Freeze the LoRA version in
   `recipe_snapshot`. `canons.lora_*` fields + trigger `wyfndrstyle` already reserved.

### Roadmap (added 2026-06-29)
- **Batch worker** (deferred — mobile is mostly review/library, not creation): resumable, cost-capped,
  enables remote/bulk generation. Build when remote creation becomes the need.
- **Live procgen renderer, evolutionary:** (1) NOW — harness exports each runtime mesh via GLTFExporter
  and pushes the GLB to `/api/import`; Crucible renders it live in the GLBViewer (done — import +
  library accept `model` format). (2) LATER — run the game's generators *inside* Crucible. (3) GOAL —
  a **reusable generation/render kit** (the kit-registry "linked art-kit") so new games plug in instead
  of starting from scratch.

### Roadmap — asset ingestion (added 2026-06-29)

**A. Bulk / multi-type import from a game harness.** Today "Export to Crucible" grabs the Props
gallery's art-kit ids (the selected pack's props + the mobs it references) for ONE pack. Extend to
grab any/all asset types — one category at a time or in bulk. The catch: **each category has a
different id source in the harness**, so design per source (don't dump the flat `ART_KIT` registry —
it would silently miss the real creature/character sets):
- **Props** — pack-scoped art-kit ids (`collectArtKitIds(pack)`, prefix `prop.`). Bulk = iterate all
  packs (`loadAllPacks`), dedup, tag each with the pack(s)/region(s) that use it. *Proven path,
  lowest risk → the recommended first slice.*
- **Creatures / beasts** — NOT just `ART_KIT`'s `mob.*` kit; the real set is the **Bestiary** (~77
  mobs via the creature engine / descriptors, `loadBestiary`). Needs the creature build path, not
  `generateArtKit` alone. Tag by family/biome.
- **Characters** — the class-silhouette templates (`makeHumanoidGenerator`, `char.*`). Static posed
  export; tag by class.
- **Biomes** — NOT a single mesh; a whole zone/scene. Either export a representative scene capture or
  fall back to a screenshot (`format: image`). Different mechanism — decide separately.
- Crucible side already accepts all of this (type + tags + GLB/image); this is **mostly harness
  work** + a category-select UI. Per-asset `artKitId` keeps re-sync (replace-not-duplicate) working.
- **Decisions needed (Kevin):** (1) scope per run — current pack vs all packs? (2) creatures: full
  Bestiary or just the legacy `mob.*` kit? (3) biomes: scene-capture GLB or screenshot? (4) for a
  prop used by several packs, tag with all regions or just one?

**B. Reverse sync — trigger a grab FROM Crucible.** Today the push is harness→Crucible (the game
initiates). Add a Crucible-initiated pull so a "grab latest from <game>" can be triggered from the
studio. Crosses an architecture boundary (Crucible must reach the game's generators). Options,
cheap→expensive:
1. **Remote-trigger endpoint on the game** — the deployed game exposes an authed
   `POST /export-to-crucible` that runs the same export; Crucible calls it. Needs the game
   running/deployed; loosest coupling.
2. **Run the generators inside Crucible** — import the game's art-kit module and generate locally
   (no game runtime); couples the code. This is the deferred "run generators in Crucible" step.
3. **Shared art-kit package** — extract the generators to a package both consume (the "reusable
   art-kit kit" end-goal).
- Ties directly into the existing **"Live procgen renderer, evolutionary"** line (run generators in
  Crucible → reusable kit). **Decision needed:** which direction — and is the trigger per-game ad-hoc
  or a registered "linked source" per project?

### Multi-game import — other games (added 2026-06-29)
Crucible projects created (prototype) for **storm-break-hockey**, **corrupted-veil**
(`corrupted-void` repo), **fractured-domains** — `/api/import` is game-agnostic, so receiving
costs only the project row (done). What's left per game is a small EXPORT ADAPTER (no Crucible
change). Explored verdicts:
- **Storm-Break Hockey** — vanilla three.js, fully runtime-built meshes (3 player archetypes,
  puck + skins, 9 obstacle types, rink). GLB path applies. Builders are inline `_build*` fns in
  `src/main.js` + `ObstacleRenderer`/`Materials` (not a clean registry) → adapter must call/expose
  them. Has a menu-preview + hazard-editor to host the dev button. **Best first (fastest QA loop).**
- **Corrupted Veil** — vanilla three.js, blueprint-driven generators: `ProxyKitbasher.assemble`
  (46 creatures), `HeroBuilder.build` (6 classes), `EnvironmentFactory` (biome props). GLB path
  applies (~400 LOC). No preview harness → adapter builds its own trigger UI. Loops
  `MonsterRegistry.json` + the player registry.
- **Fractured Domains** — **2D Canvas, no three.js**; generators emit `HTMLCanvasElement`. GLB does
  NOT apply (would need a 3D rewrite). BUT the **image-grab path works**: `canvas.toDataURL()` →
  `/api/import` as `format: image` (library already renders images). Grab tiles/sprites/props as PNGs.

**Reusable adapter recipe** (extract once, each game adapts): a generic core
`exportToCrucible(items, { url, token, slug })` — strip non-mesh renderables → `GLTFExporter`
(or skip for 2D) → base64 → POST with `{type,label,artKitId,tags}` + progress. Each game writes a
thin builder-list adapter (its `_build*` / registry loop) + a DEV-gated button; token from the
game's local `.env` (never its public bundle), `VITE_CRUCIBLE_URL` → Crucible. The Wayfinders
`exportToCrucible.ts` is the working reference. Each adapter needs an in-game click-test (QA).

### Roadmap — authoring & reuse (added 2026-06-29)

**C. In-Crucible editor view (levels or art).** Two distinct editors — decide scope before building:
- **Scene / level composer** — drag library assets (props/creatures/biomes) onto a canvas to lay out
  a scene or level, then export the layout (placements + asset refs) back to a game or as a reusable
  set. project-mmo already has a pack/placement Editor; Crucible's version composes from the
  *grabbed/generated* library and is game-agnostic. Output = a placement manifest, not baked geometry.
- **Per-asset art editor** — tweak a single asset post-gen: recolor to the canon palette, swap
  materials, re-pose, re-scale/orient, relight. Lighter than full retopo; complements the planned
  **Kiln** finishing module (retopo + baked PBR).
- Decisions: which first (scene composer vs art editor)? layout-data vs merged-GLB output? 2D canvas
  vs the live 3D viewer with transform gizmos?

**D. Generate from existing assets / remix.** Condition generation on a library asset, not a blank prompt:
- **Remix** — pick a source asset (its render/image) as the reference + a prompt ("this barrel as a
  crate", "autumn version of this tree") → reference-conditioned / img2img gen → review queue.
  **Nano Banana (Gemini) already conditions on reference images** — the natural lever; wire a library
  asset in as the reference input.
- **Cohesive set** — pick N anchors → generate a matching family (a whole prop set in one pass).
- Composes with the canon (style) + per-asset-type framing we already inject. Decisions: single-source
  remix vs multi-anchor set; FLUX img2img vs Nano-Banana reference path (or both); source-image capture
  (use an existing image vs a fresh turntable shot of a GLB).

**E. Save / export for use across one-to-many games (reusable kits).** Make assets portable beyond their origin project:
- **Cross-project copy / link** — promote a library asset (or a tagged set) into another game's
  project. The library is per-project today, so this adds copy-or-link semantics + a shared source.
- **Publish a kit** — package a set (a biome's props, a creature family, a character roster) as a
  *versioned kit*, export to a CDN / per-project manifest (extends Phase 3 CDN publish), so a new game
  plugs the kit in instead of starting from scratch.
- The concrete form of the existing **"reusable generation/render kit"** goal + the kit-registry
  "linked art-kit." Decisions: copy vs link; kit = static assets only or assets + their generators/canon;
  versioning + where kits live (Supabase Storage → R2 when distribution matters).

### Later phases
- **Phase 3 — bulk + finish + publish:** resumable, cost-capped **batch worker** (sync gen is
  prod-unsafe at volume); **Kiln** finishing module (retopo + baked PBR); **CDN publish** + per-project
  manifest (Supabase Storage → R2 when distribution matters).
- **Phase 4 — two-game proof:** the **deception-game train station** as a second canon (Path B — intake
  auto-draft now works with the Anthropic key) → decompose into props; zero style cross-contamination.
- **Phase 5 — avatars** (deferred): rigging-ready character pipeline, separate from props.

### Shipped 2026-06-29 (later)
- **Projects-as-Games**: home is now a **Games gallery**; per-game **/projects/[slug]** = editable
  portfolio Overview + a Generation workspace (sets the game active → Generate/Review/Canon/Prompts).
  Portfolio face (description/status/url/repo/screenshot) added to `projects` (migration 0005);
  faces stay separate. Status enum: prototype/active/shipped/paused.
- **Persistent accessible top nav** (skip link, landmarks, active route) on every page.
- **LoRA Stage 1**: training-set assembly — upload/list/remove turntable renders per project at
  `/canon`, trigger-word captions. **Stage 2 (Replicate train → poll → LoRA inference) still TODO** —
  needs a Replicate destination model (`REPLICATE_LORA_DESTINATION`) + the renders + the paid run.

### Shipped 2026-06-29 (bulk grab + splash hero + responsive)
- **Bulk import (harness side).** project-mmo preview now exports, beyond the per-pack button:
  **"All props (every pack)"** (every pack's declared props, deduped, each tagged with the pack/region(s)
  that use it) and **"All creatures"** (the **full Bestiary ~77** via the creature engine — not just the
  legacy `mob.*` kit). Characters/biomes still per roadmap. Export module refactored to a generic
  mesh→glb→POST core. (Cross-pack procedurally-placed set-dressing not yet resolved — follow-up.)
- **Splash → portfolio hero.** "Capture splash → hero" renders the title-screen `<Globe>` vista
  offscreen (`preserveDrawingBuffer`) → PNG → new authed **`POST /api/project-screenshot`** (CORS +
  Basic-auth-exempt, sets `projects.screenshot`).
- **Responsive (Kevin's choice: forms readable, grids widen).** Home/Review/Prompts grids widen +
  add columns lg→xl→1440 like Library; nav already widened. Form pages kept at reading width.

### Shipped 2026-06-29 (live library + grab-from-Wayfinders)
- **Procgen grab pipeline, end-to-end.** project-mmo's preview harness has a DEV-only
  "Export to Crucible" button (Props gallery): rebuilds each art-kit mesh via
  `generateArtKit`, serializes to .glb in-browser (GLTFExporter), POSTs to `/api/import`.
  8 Skyhold props imported + rendering live. Token in project-mmo `.env.local` (gitignored,
  never Vercel). Crucible dev runs on :3001 while project-mmo holds :3000.
- **Live 3D library.** `/library` renders every model inline in ONE shared WebGL context
  (drei `<View>` + `View.Port` — avoids per-tile canvas/context exhaustion). Each tile:
  normalized-to-fit (center + scale-to-FIT_SIZE so a tiny crystal and a tall monument frame
  the same), gentle auto-spin, **drag-to-rotate inline**. Reduced-motion respected; per-tile
  error boundary.
- **Focus modal** (hover-reveal magnifier, top-right of each tile → opens): full orbit/zoom/
  pan viewer + metadata (triangles, mesh count, material color swatches computed from the GLB,
  added date, origin tags) + **editable notes** (persisted; routes to reference_assets or
  assets by source) + download. Migration 0009 (`notes`).
- **Origin/hierarchy tags.** Export auto-derives tags from the source pack/region (e.g.
  "Skyhold") + theme; shown per-tile + as filter chips. Game = the Crucible project; tags add
  the levels below. Generic — any game's harness contributes its own. Migration 0008 (`tags`).
- **Responsive.** Grid 2→3(sm)→4(lg)→5(xl)→6(1440); page container + nav + modal widen lg→1440.
- **Import endpoint:** CORS (OPTIONS + ACAO:*) so the harness can POST cross-origin; exempt
  from the Basic-auth gate (token-authed).

### Shipped 2026-06-29 (design system + import CORS)
- **Atelier design-system migration complete.** All remaining pages moved off raw zinc/amber to
  Atelier tokens + `components/ui` primitives (Button/Input/Textarea/Label/Card/Badge), matching
  home/nav/library: generate, canon (+LoRA TrainingImages), review (+GLBViewer frame), prompts,
  project detail, new game, intake. Convention: success → `accent` (sage), primary CTA → `primary`
  (terracotta), errors → `destructive`. Native `<select>` kept (no select primitive) but token-styled
  via a local Input-mirroring const — **candidate for a real Select primitive later.** 3D Canvas /
  IBL lighting in GLBViewer untouched (frame-only restyle).
- **Import endpoint CORS** — `/api/import` now handles OPTIONS preflight + `Access-Control-Allow-Origin:*`
  on all responses (token-authed, so origin-open is fine), so the Wayfinders harness can POST GLBs
  cross-origin from its own dev server / Vercel.

### Shipped 2026-06-29 (parallel batch)
- **Nano Banana** (Gemini 2.5 Flash Image) image provider — selectable per generation, conditions
  on the canon's reference images (style anchor). Needs `GEMINI_API_KEY` (free tier).
- **Per-asset-type framing** — canon=style, asset type=format (+ format nevers). Asset-type dropdown.
  Fixes the no-faces-vs-portrait conflict.
- **Prompt library** embed bug fixed (named the assets FK). Harder low-poly Wayfinders prefix.
- vitest aliases `server-only` so pure helpers in server modules are testable. 72 tests.

### NEXT: the LoRA slice (the real 3D-faceted enforcer)
Replicate, Path A per CANON_INTAKE §5. Train on turntable renders of the game's faceted assets;
freeze the LoRA version in recipe_snapshot. Prereq: a turntable-render dataset from the engine.

### Validated 2026-06-29
- **Living Dungeon control test passed.** Seeded its canon from the March art bible → generated
  on-style 2D floor tiles **and** a player portrait that match the March originals. Confirms the
  canon+scaffolding pipeline is sound; the Wayfinders gap is specifically 3D-faceted difficulty.
- **Prompt library** (`/prompts`) shipped — reuse/tweak past prompts.

### Smaller follow-ups
- **Per-asset-type framing** (worthwhile): style belongs to the canon, *format* belongs to the asset
  (tilesheet vs portrait vs sprite vs icon) — the March model used per-asset-type prompts. Surfaced by
  the LD portrait: the canon's `no human faces` never (right for tiles) fights a portrait. A small
  asset-type → framing+nevers map would fix it cleanly.
- **Intake "Save as canon"** — `/intake` currently drafts then links to `/canon`; wire a direct save so
  it's one flow (no copy-paste). Useful for the deception game.
- Verify TRELLIS version hash before heavy 3D use; migrate off deprecated `next lint`; rotate the old
  March Supabase anon key.
