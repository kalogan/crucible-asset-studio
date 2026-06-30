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

**F. Upgrade a procgen asset → refined 3D model (TRELLIS / other).** Take a grabbed/procgen library
asset and produce a higher-fidelity 3D model from it (a per-asset "Upgrade to 3D" action → review queue):
- **Image asset → 3D** — run the asset image through TRELLIS (image→3D); reuses the existing
  `convertAssetTo3D` / generate pipeline. Direct for the 2D-game grabs (Fractured Domains) + image refs.
- **Procgen GLB → refined 3D** — capture a hero render of the chunky low-poly GLB → TRELLIS → a cleaner
  detailed mesh; or a mesh→mesh refiner model. Turns the faceted procgen look into a finished asset.
- Money boundary (TRELLIS ≈ $0.09/run) — guarded by the daily cap + review gate. Decisions: source
  (image vs GLB-render); model (TRELLIS vs alternative); replace vs version the asset.

**G. Animation viewer — play any asset's clips (idle/walk/attack/dance).** A viewer (in the focus modal
+ a dedicated surface) that detects a model's glTF AnimationClips and lets you pick + play them. Works
for any asset that CARRIES clips. Open question (being explored): project-mmo's anims are PROCEDURAL
(no clips) → exporting them playable needs the export to **bake** the procedural animator into glTF
clips (sample bone/part transforms over time → KeyframeTracks); deceive-me-daddy's authored GLBs likely
already have clips (the easy test case). So: build the player now (plays embedded clips); baking
procedural anims is the follow-on per-game export work.

### Roadmap — reusable systems / kits / atoms (added 2026-06-29)
Meta-goal: stop rebuilding the same web-3D-game plumbing per project. Standardize the recurring layers
so Crucible can **"spin up these systems"** for a new game, and make **composable asset-systems**
(a campfire = mesh + FX + lighting + sound + params as ONE unit) that export/import across games and
drop into a level in the scene editor.

Three tiers:
- **Atoms** — smallest reusable units: a light rig, a PRNG, a geometry/material helper, a single FX
  (smoke/glow/particles), a HUD widget, a settings field.
- **Systems** — a working subsystem: the 3D render bootstrap (Canvas/renderer/camera/post-fx/resize/
  loop), input + camera controls, animation runtime, audio, settings store, HUD shell, a Colyseus room,
  persistence (Supabase), deploy config (Vercel/fly.io/Docker).
- **Kits** — bundles forming a starting point: "r3f game starter", "vanilla-three starter", "Colyseus
  multiplayer", each wiring atoms + systems so a new game begins with the plumbing done.

**Composable asset-systems** (the campfire): an asset isn't just a mesh — it's `{ meshes + FX +
lighting + sound + behavior params }` packaged as one unit; export it from game A → import into game B,
or drop it into a level in the scene composer. Extends the library + scene editor + kit registry.

**Where kits live (decide after the audit):** (a) a versioned workspace/npm package games install;
(b) a template/starter repo cloned per game; (c) Crucible as the catalog + a "scaffold new game"
generator. Likely a mix — a `game-kit` package for the code, Crucible as the catalog/scaffolder.

**Kit inventory (from the audit — project-mmo / storm-break-hockey / corrupted-void / woodturning-studio
/ deceive-me-daddy).** Prioritized by adoption × low-risk. project-mmo is the "gold reference" for most.

| Candidate | Tier | Adoption | Notes |
|---|---|---|---|
| Settings store (load/save/subscribe) | system | 5/5 | localStorage + schema-version merge; React(Zustand) + vanilla(emitter) variants |
| Scene state machine (title→play→pause→over) | system | 5/5 | table-driven enter/exit/update |
| Seeded PRNG + sim utils (mulberry32) | atom | 2/5 + discipline | formalize project-mmo `sim-core`; "never Math.random in sim" |
| Lighting rig (ambient+sun+fill+rim, shadows) | atom | 3/5 | near-identical; r3f + vanilla variants |
| Bloom / EffectComposer pipeline | system | 4/5 | RenderPass→Bloom→OutputPass; r3f wrapper + vanilla class |
| Audio engine (Web-Audio synth, worker, cache) | system | 3/5 | project-mmo's is best; others reinvent |
| Procedural animator (idle/walk + one-shots) | system | 3/5 | the no-rig driver; ties to anim baking + a SkeletalAnimator sibling (2/5) |
| HUD shell + menu/settings modal | system | 4–5/5 | per-frame DOM mutation (no React churn); shared settings tabs |
| Input mapper + keybind rebinding | atom | 2/5 | conflict-swap logic |
| Vite preset + deploy templates (Fly/Vercel/Docker) | kit | 4–5/5 | monorepo vs single-app; Colyseus-on-Fly + SPA-on-Vercel presets |
| Colyseus room template (rooms/schema/lobby) | system | 2/5 | project-mmo ≈ deceive-me-daddy; ~1k LOC dup |
| Palette + material factory (flat + emissive/Bloom) | atom | 1–2/5 | project-mmo PAL + `material:<name>` discipline |
| First-person controller / camera rigs | atom | 2/5 | FPS reusable; orbit/chase too game-tuned to share |

Cross-cutting: **r3f (2) vs vanilla-three (3) split** — most render/anim atoms need TWO variants.
**Correction:** NONE of the games use Supabase (project-mmo = Postgres+Kysely+Redis; others = localStorage/
IndexedDB) — Supabase is Crucible's own stack, so a Supabase adapter would be a *new* convenience, not a dedup.

**First "spin-up" kit (Phase 1, do first):** settings store + scene state machine + lighting rig + bloom +
seeded-PRNG + vite/deploy presets — all 3–5/5 adoption, low complexity. **Where kits live:** a versioned
workspace package (mirror project-mmo's `packages/shared` + `sim-core`) with r3f + vanilla entry points,
catalogued/scaffolded by Crucible. Decide package layout before extracting.

#### game-kit — built vs gaps (audit 2026-06-29; live view at `/kit`)
**Built — 20 systems** (`github.com/kalogan/game-kit`): prng · settings · scene-state · lighting (+r3f) ·
postfx (+r3f) · audio · hud · anim · geo · palette · artkit · input · save · math · **camera · render ·
presets · fx · net · clip**. **Every system the audit flagged is now in the kit** (HIGH trio, MED
input/save/math, and the remaining camera/render/netcode/fx/skeletal/presets). **Remaining frontier:**
- **r3f variants** of the new vanilla systems (camera/render/fx) for the 2 r3f games (only lighting+postfx
  have r3f variants today).
- **LOW** — i18n · a11y filters.
- The real wins now: **adopt the kit in a real game** (validate the API end-to-end), and grow `/kit` from a
  dashboard → a **scaffolder** ("pick pieces → new game" — the puzzle-pieces endgame).

The **`/kit` health-check** page shows the live adoption matrix (system × game: uses-own / opportunity /
n-a) + "build next / adopt here / expand to" rankings — now reflecting 20 built systems.

**Recommended next steps to improve the kit:**
1. Add the **foundational trio** (art-kit registry + geometry/material helpers + palette) — unlocks procgen
   parity + the Roblox renderer in one move (highest leverage).
2. **Input + camera rigs** next.
3. **Publish + version** it (set `exports` for `.`/`./r3f`, add a `tsc→dist` build) so games can install it;
   then **prove it** by adopting it in ONE game (swap storm-break's bloom/lighting to game-kit) — validates
   the dual vanilla/r3f API.
4. **Crucible as the catalog/scaffolder** — a page listing kit pieces (copy/scaffold), → a "new game" generator.

### Roadmap — "puzzle pieces": plug-and-play game kits (added 2026-06-29)
The end-state Kevin wants: **pick puzzle pieces, get a working game.** Beyond atoms/systems, define KITS =
opinionated, RUNNABLE bundles that wire systems + glue + a minimal scene:
- **Starter kits:** `r3f-3d-starter`, `vanilla-three-starter`, `isometric-roguelike`, `multiplayer-arena`
  (Colyseus), `procgen-world`, `first-person-walker`. Each = a manifest of systems + glue + a runnable scene.
- **Crucible = catalog + scaffolder:** browse pieces/kits, toggle what you want → it scaffolds a new game
  repo (or wires the `game-kit` package). The "spin up these systems" UX, made concrete.
- **Composability the whole way down:** kits supply *systems*; composable asset-systems (campfire) + the
  scene editor supply *content*; the agnostic descriptor makes it engine-portable (web ↔ Roblox).
- **Decision:** kit = generator (scaffolds files) vs runtime (`createGame({ systems })` composed at boot)?
  Likely both — a config-driven bootstrap + a Crucible repo-skeleton generator.

**Animation baking (in progress):** bake procgen games' PROCEDURAL animators (project-mmo —
`ProceduralCharacterAnimator` / creature animator, segmented groups, no skeleton) into glTF
`AnimationClip`s on export, so grabbed creatures/characters animate in Crucible's viewer and carry
clips when reused. The procedural animator itself is a prime "system" kit candidate.

### Roadmap — Roblox + web↔engine porting (added 2026-06-29)
Added 4 Roblox/Luau procgen games as projects (GitHub kal101246): **dino-tracks, visual-escape,
arrivals, polymatrix** (public; auto-filled from GitHub metadata). Roblox is NOT three.js — the
`GLTFExporter`→GLB grab does NOT apply (Luau + Parts/MeshParts, studs, Color3). So the grab path differs.

**The bridge = an engine-agnostic asset SCHEMA (dino-tracks, mapped).** dino-tracks' interchange is a
**socket-schema + DNA descriptor** (engine-agnostic Luau data, `src/shared/Kitbash/SocketSchemas.luau`
+ `Data/*Registry.luau`): an archetype defines named sockets `{ CF, Size }`; a descriptor's `DNA` maps
each socket → a part name (+ stats/color/scale). Its `KitbashAssembler.luau` already EMITS Roblox (DNA +
schema → welded Model, procedural-primitive fallback when a part is missing) — but **no three.js emitter
exists**. Conversions: studs↔m (~1 stud≈0.28m), `Color3`↔hex, `CFrame`↔quat+pos, Material enum↔PBR.
Generalize this into the interchange standard; make **Crucible the porting hub**:
- **Ingest (Roblox→Crucible):** read the agnostic descriptors (JSON) → a `descriptor→three` builder
  renders them in Crucible's viewer/library (no GLB needed). For pure-Roblox assets, capture-as-image is
  the fallback.
- **Port web→Roblox:** a `descriptor→Luau/rbxm` emitter — author/edit in Crucible (scene editor +
  composable asset-systems) → export Roblox instances. "Port from here with ease."
- **Port Roblox→web:** Roblox Parts → descriptor → three (+ optional GLB).
- This unifies with the **composable asset-system** (the campfire bundle IS a descriptor) and the
  **kits** (the `descriptor→three` builder + `descriptor→luau` emitter are kit "systems"; likely live in
  the `game-kit` package with `web` + `roblox` targets).

**Build plan (from the audit, ~1k LOC):** (1) export the Luau registries+schemas → `descriptors.json`
(small Luau→JSON script); (2) build a `descriptor→three` renderer in the `game-kit` (sockets → primitives
/ loaded parts, apply DNA + scale + studs→m) → render in Crucible's viewer/library; (3) web→Roblox reuses
`KitbashAssembler` (wrap it). Decisions: adopt dino-tracks' socket/DNA schema as the standard (or a
superset that also covers the three.js games' art-kit ids)? where the builders live (`game-kit/targets/
{web,roblox}`)? asset-resolution (where `Raptor_Torso` parts come from — CDN vs procedural greybox).

### Roadmap — NPC expansion: memory v2 + behavior (added 2026-06-29)
Where `game-kit/npc` is today: dialogue brain (provider seam + Grok + firewall), budgeted, and a
STRING memory (episodic append + relational summary from `recall` notes only + last-8-turns view) over an
injectable `NpcMemoryStore` (in-memory default). NO summarization model, NO semantic recall, NO behavior.
Behavior EXISTS in Wayfinders but in **sim-core** (`tickNpcBehavior` + nav `Pathfinder` + bounds
wander/region/patrol; `companionManager`/`tickCompanionFollow`) — NOT in the npc module. **Invariant to
preserve: the LLM never moves an NPC.** Movement is pure, seeded, deterministic; the brain stays advisory
(exactly the intent-firewall philosophy). Two independent tracks:

**Track A — Memory v2 ("local model": insert / summarize / store / load / recall).** Each phase is a seam
+ a local default + a provider/remote adapter as a future add; all pure logic unit-tested with a fake model.
- **A1 — Durable store adapter** ✓ SHIPPED (game-kit `7a52cf2`): `createKvNpcStore(kv)` over any async
  `KVStore` the game supplies (localStorage/Redis/DB/file) + `withSafeStore` degrade wrapper + `createInMemoryKv`.
  Zero-dep (no DB pulled into the kit).
- **A2 — Rolling summarization** ✓ SHIPPED (game-kit `7a52cf2`): `Summarizer` seam +
  `createExtractiveSummarizer` (local, deterministic) + `createProviderSummarizer(complete)` +
  `consolidateMemory`; `createNpcBrain` takes an optional `summarizer`/`consolidateKeepRecent` and folds the
  episodic overflow into the summary. Opt-in; verbatim-only default unchanged.
- **A3 — Embeddings + semantic recall** ✓ SHIPPED (game-kit `749b1ff`): `Embedder` seam +
  `createHashingEmbedder` (LOCAL, zero-dep, deterministic LEXICAL default) + `cosineSimilarity` +
  `selectRelevantTurns` (top-k relevant + recent). `NpcMemoryTurn` carries an optional embedding;
  `createNpcBrain` opt-in `embedder`/`recall` feeds the model the most RELEVANT past turns, not recency.
  **Remaining opt-in:** a real local MODEL (transformers.js all-MiniLM ~25MB) is a one-file `Embedder`
  adapter — that dep call still stands; the lexical default ships now so the whole recall path works.
- **A4 — Consolidation / forgetting** (polish): periodic merge of near-duplicate memories + recency×salience
  decay so long-term memory stays small + relevant.

**Track B — Behavior (walking / pathfinding / actions), distilled from sim-core.** Sim-side + deterministic
(seeded via kit `prng`); the game renders synced state (an optional r3f helper renders it).
- **B1 — Nav + pathfinding** ✓ SHIPPED (game-kit `749b1ff`): `createGridNav` — a walkable grid +
  deterministic A* (octile/Manhattan, no corner-cutting) behind a `Pathfinder` seam; world↔cell mapping.
  Three-free.
- **B2 — Deterministic behavior runtime** ✓ SHIPPED (game-kit `749b1ff`): `createNpcBehavior` — seeded
  deterministic walking over a `Pathfinder`; bounds wander/region/patrol (pick goal → route → walk →
  idle). Three-free; the LLM never drives it.
- **B3 — Steering / follow** (from `tickCompanionFollow`): follow a moving target + arrive + separation —
  powers companions and "walk beside the player" NPCs.
- **B4 — Action / utility layer:** a small utility-AI (or tiny behavior tree) selecting among deterministic
  actions (idle/wander/patrol/goToStation/interact/flee). This is the "actions" ask.
- **B5 — Reasoning↔behavior bridge (the careful boundary widening):** OPTIONALLY let the brain *suggest* a
  high-level goal via a NEW bounded intent (`goTo`/`emote`/`setGoal`) added to the firewall as an explicit,
  reviewed widening. The deterministic layer validates + plans + executes; the LLM still never sets a
  position. This is where "I'll show you the way" becomes movement — safely. Stop-and-confirm before B5.

Sequencing: A1→A2→A3 and B1→B2→B3 are independent and parallelizable; B5 is gated behind a firewall-widening
review. Relates to [[project-game-kit-frontier]].

### Later phases
- **Phase 3 — bulk + finish + publish:** resumable, cost-capped **batch worker** (sync gen is
  prod-unsafe at volume); **Kiln** finishing module (retopo + baked PBR); **CDN publish** + per-project
  manifest (Supabase Storage → R2 when distribution matters).
- **Phase 4 — two-game proof:** the **deception-game train station** as a second canon (Path B — intake
  auto-draft now works with the Anthropic key) → decompose into props; zero style cross-contamination.
- **Phase 5 — avatars** (deferred): rigging-ready character pipeline, separate from props.

### Shipped 2026-06-29 (game-kit npc — Wayfinders NPC brain)
- **NPC reasoning module** ported from Wayfinders into game-kit behind a new **server-only** entry
  `game-kit/npc` (game-kit `f2ac2f4`). It's the Grok-backed conversation+memory brain, generalized:
  provider-agnostic seam (Grok = `createGrokProvider({apiKey})` → just `api.x.ai/v1` + a model), the
  **firewall** `parseReasoningResponse` (validate-and-drop bounded intents: say/setMood/wait/end/recall),
  a budgeted provider (timeout + global/per-player rate limit + scripted fallback — never throws/hangs/
  overspends), a pure per-(NPC×player) memory model + injectable `NpcMemoryStore` (in-memory default; DB
  adapter = future add), and `createNpcBrain().say()` orchestration + companion banter. **zod scoped to the
  npc entry only** (Director's call) — three/r3f entries stay zero-dep. Server-side boundary preserved:
  keyed providers never touch the browser bundle. Gate: tsc 0 · 216 tests (+38).
- **/kit catalog**: added `npc-reasoning` (kit tier, module `npc`) — 21 built systems now; project-mmo=core,
  others n/a. Catalog-derived derive tests still green. (Pure-core pass; DB store adapter + a Crucible NPC
  demo page deferred per scope.)

### Shipped 2026-06-29 (later)
- **Projects-as-Games**: home is now a **Games gallery**; per-game **/projects/[slug]** = editable
  portfolio Overview + a Generation workspace (sets the game active → Generate/Review/Canon/Prompts).
  Portfolio face (description/status/url/repo/screenshot) added to `projects` (migration 0005);
  faces stay separate. Status enum: prototype/active/shipped/paused.
- **Persistent accessible top nav** (skip link, landmarks, active route) on every page.
- **LoRA Stage 1**: training-set assembly — upload/list/remove turntable renders per project at
  `/canon`, trigger-word captions. **Stage 2 (Replicate train → poll → LoRA inference) still TODO** —
  needs a Replicate destination model (`REPLICATE_LORA_DESTINATION`) + the renders + the paid run.

### Shipped 2026-06-29 (scaffolder v2 — templates: multiplayer + procgen-world)
- **Scaffolder v2** (`lib/scaffold/generate.ts`, `/kit/scaffold`) — the picker now sits under a **template**
  selector that layers richer starters on top of the system picker:
  - **Multiplayer (Colyseus)** — emits a standalone `server/` Colyseus package (Server + `GameRoom` with
    `@colyseus/schema` Player/GameState) **and** `src/net/colyseusRoom.ts`, a client adapter that REALIZES
    game-kit's transport-agnostic `RoomClient<S>` seam over `colyseus.js` (the "future add" net/index.ts
    documents). Wires `connectColyseus()` into the entry (both targets); adds `colyseus.js` to client deps.
  - **Procgen World** — emits `src/world.ts` (`buildWorld({ seed })`: seeded jittered ground + scattered
    faceted rocks/trees via game-kit `createRng`/`createPalette`/`nonIndexedFlat`/`jitterVerts`) + a
    `<World seed/>` r3f wrapper. Same seed → identical world. Forces in prng/palette/geo/lighting/bootstrap.
  - Templates pre-check their implied systems in the UI; "Blank" = the v1 free picker (back-compat: omitting
    `template` ≡ `"blank"`, verified by test).
- **Fixed two real wiring bugs** the string-only tests missed (procgen depends on a working bootstrap):
  `render-bootstrap` now uses the REAL `createRenderer()` (no `app` arg, no returned camera — it mints its
  own `PerspectiveCamera` + resize) and `createLoop((dt,alpha)=>…)`; `camera-rigs` calls
  `createOrbitCamera(camera, opts)` not `(camera, domElement)`.
- **GitHub bootstrap** (`a4617d2`) — every starter now ships `create-repo.sh`: `sh create-repo.sh [name]
  [private|public]` runs git init + first commit + `gh repo create --source --push` using the user's own
  `gh` auth (no tokens, no server — Director chose the script-in-zip path over a token'd server action). Plus
  a `.gitignore` (keeps node_modules out of the first commit) + README "Push to GitHub" section + UI hint.
- Gate (Crucible): typecheck 0 · lint 0 · test 149 · build 0. `/kit/scaffold` 12.2 kB.

### Shipped 2026-06-29 (kit r3f variants + /kit scaffolder)
- **game-kit r3f variants** (pushed `e35ad84`) — `useOrbitCamera`/`useChaseCamera`/`useFirstPersonCamera`,
  `<Particles>`, `useClipPlayer`, `useFixedLoop` (via `game-kit/r3f`). The 2 r3f games can now adopt the
  WHOLE kit, not just lighting/postfx. Gate: tsc 0 · 178 tests.
- **/kit scaffolder** (`/kit/scaffold`) — the dashboard → scaffolder step: pick a target (r3f/vanilla) +
  systems → generate a runnable Vite starter that depends on `game-kit` and wires the picked pieces. Every
  generated import resolves to a REAL game-kit export (render-bootstrap hoisted first to avoid a TDZ; r3f
  components as `<Canvas>` children, r3f hooks in an inner `Systems()`); copyable file tree + **Download
  .zip** (jszip). `lib/scaffold` pure + tested. "Pick pieces → working game."
- Gate (Crucible): typecheck 0 · lint 0 · test 138 · build 0.

### Shipped 2026-06-29 (game-kit complete — camera/render/presets/fx/net/clip)
- **game-kit's six remaining systems** (pushed `6fbca78`) — **camera** (orbit/chase/FPS, no-alloc),
  **render** (vanilla bootstrap + tested fixed-timestep `advance`), **presets** (vite/fly.toml/vercel.json/
  Dockerfile templates), **fx** (pooled particle emitter, zero-alloc), **net** (transport-agnostic
  RoomClient + LocalRoom, colyseus-free), **clip** (skeletal AnimationMixer player + procedural→clip
  baker). Gate: tsc 0 · **178 tests**. The kit now has **20 systems** — every audited gap filled.
- **`/kit` catalog** flipped these six `planned → built`; the derive tests now assert invariants
  (catalog-derived counts) so they survive director edits. Gate (Crucible): typecheck 0 · lint 0 · test 123 · build 0.

### Shipped 2026-06-29 (game-kit input/save/math + Kit health-check)
- **game-kit input/save/math** (pushed `b81600d`) — keybind/action mapper (conflict-swap), versioned +
  checksummed save store, math/easing/vec3 utils. All three-free. Gate: tsc 0 · 117 tests.
- **Kit health-check dashboard** (`/kit`) — live **adoption matrix** (system × game: uses-own /
  opportunity / n-a) + coverage stats + per-game bars + **"build next / adopt here / expand to"** rankings,
  all derived purely from a director-editable catalog (`lib/kit/catalog.ts`, tested in `derive.test.ts`).
  The catalog/scaffolder surface, starting as a dashboard — shows where systems are used vs not + what's
  highest-leverage next.
- Gate (Crucible): typecheck 0 · lint 0 · test 123 · build 0.

### Shipped 2026-06-29 (foundational kit trio + Roblox Phase 2)
- **game-kit foundational trio** (pushed `30eb754`) — `geo` (nonIndexedFlat + deterministic jitterVerts),
  `palette` (createPalette → color/flatMat/emissiveMat factories incl. the toneMapped:false bloom recipe),
  `artkit` (the `id → (rng)=>Object3D` registry, `generate(id,seed)` deterministic). The procgen backbone
  every three.js game uses. Gate: tsc 0 · 82 tests.
- **Roblox Phase 2** — DNA part **shapes**: socket-name heuristic picks a characterful primitive
  (head→sphere, leg/arm/neck→cylinder, tail→tapered cylinder, torso/default→box) instead of uniform
  greyboxes. **web→Roblox Luau emit**: `descriptorToLuau` → a self-contained `buildModel()` (Parts at
  socket CFrames, Color3, studs kept native) + Copy/Download `.luau` per descriptor on `/roblox`. The
  "port from here" lever. (Next: load the real DNA parts via the art-kit registry; round-trip Roblox→web.)
- Gate (Crucible): typecheck 0 · lint 0 · test 116 · build 0.

### Shipped 2026-06-29 (r3f kit variants + asset-system v2.1 + Roblox Phase 1)
- **game-kit r3f variants** (pushed `55cc51b`) — `<LightingRig>` + `<PostFx>` + a `game-kit/r3f` entry,
  sharing `LIGHTING_DEFAULTS`/`BLOOM_DEFAULTS` with the vanilla builders; react/r3f/drei/postprocessing as
  OPTIONAL peer deps (vanilla entry stays react-free). Gate: tsc 0 · 58 tests.
- **Asset-system v2.1** — importing a system into the scene composer now also renders its **lights**
  (point/directional/ambient) live; added an **FX field + editor** (`manifest.fx[]`, stored/edited; scene
  rendering of fx is the next step). "Clear scene" drops instances + lights.
- **Roblox ingest Phase 1** — `/roblox` renders dino-tracks' engine-agnostic descriptors as greybox
  three.js: `lib/roblox` socket/DNA schema + `descriptor→three` builder + studs→m conversion (0.28) +
  fixtures (Biped/Quadruped archetypes, Raptor/Rex/Trike). Read-only render; **next: DNA part-loading,
  GLB export, web→Roblox Luau emit** (reuse dino-tracks' KitbashAssembler).
- Gate (Crucible): typecheck 0 · lint 0 · test 109 · build 0.

### Shipped 2026-06-29 (asset-system v2 + game-kit Phase-2)
- **Asset-system v2** — `/systems` gains a per-system **lights + sounds editor** (add/remove point/
  directional/ambient lights + sound rows; full manifest re-validated + persisted). The **scene editor**
  (`/editor` Scene mode) can now **import a saved system** — resolves each part's assetId→library URL and
  places all parts at their relative transforms (the campfire dropped into a level). Skips unresolved parts.
- **game-kit Phase-2** (repo: github.com/kalogan/game-kit, pushed) — added **audio** (Web-Audio manager,
  channel volumes, lazy ctx, DOM-safe), **hud** (framework-agnostic DOM-layer shell over a pure registry),
  **anim** (procedural segmented-rig animator: idle/walk + wave/jump, rest-capture/restore, renderer-free).
  Gate: tsc 0 · 58 tests. r3f variants of lighting/postfx still TODO.

### Shipped 2026-06-29 (asset-systems + game-kit + Roblox onboard)
- **Composable asset-systems v1** — `/systems`: group library MODEL assets into a named `AssetSystem`
  (manifest = parts + optional lights/sounds/params, schema-ready), persisted (migration 0010), download
  the manifest JSON. Scene-editor import + the lights/fx/sound editors are the next steps.
- **`game-kit` package** (`web-projects/game-kit`) — Phase-1 reusable systems from the audit: seeded PRNG
  (mulberry32), settings store, scene state machine (pure, tested) + lighting rig + bloom/post-fx (vanilla
  three; r3f variants TODO). Standalone (own pnpm root). Gate: tsc 0 · 28 tests.
- **4 Roblox games onboarded** as projects (dino-tracks / visual-escape / arrivals / polymatrix) +
  dino-tracks agnostic-schema audit (socket/DNA + KitbashAssembler) → the web↔Roblox porting roadmap.
- Gate (Crucible): typecheck 0 · lint 0 · test 106 · build 0.

### Shipped 2026-06-29 (animation viewer + scene composer + deceive-me-daddy)
- **Animation viewer.** The focus modal now plays a model's embedded glTF AnimationClips — a clip
  picker (idle/walk/attack/dance/…) auto-plays an idle-ish clip on open, click to switch. Uses drei
  `useAnimations` + `SkeletonUtils.clone` (so rigged/skinned meshes deform correctly). Clip-less assets
  show no picker. Procgen games (project-mmo) are PROCEDURAL (no clips/skeleton — confirmed) → playable
  export needs **baking** (sample animator → KeyframeTracks → clips); that's the per-game follow-on.
- **Scene-layout composer.** `/editor` gains an Object/Scene mode toggle: Scene mode adds multiple
  library models, transform each (gizmo per selection, orbit suspended mid-drag), export the combined
  scene as one GLB. Shared `<Model>` loader extracted (object + scene reuse it).
- **deceive-me-daddy onboarded** as the animation TEST IMPORT: project created + 7 non-DRACO GLBs
  imported (4 rigged characters Robot/Fox/CesiumMan/RiggedFigure + 3 props) — they carry real clips, so
  the viewer plays them directly (no baking). (DRACO assets LittlestTokyo/ToyCar skipped — viewer isn't
  DRACO-configured; a follow-up if wanted.) Now 7 projects total.
- Gate: typecheck 0 · lint 0 · test 103 · build 0.

### Shipped 2026-06-29 (import-from-GitHub + object editor + more games)
- **Import a game from GitHub.** `/projects/new` has an "Import from GitHub" field: paste a repo URL
  (or `owner/repo`) → server fetches the repo's metadata via the GitHub API → auto-fills
  name/description/url/repo → creates the project. Public repos work unauthenticated; private need
  `GITHUB_TOKEN`. Pure parse/map helpers (`lib/github/repo.ts`) tested; `fetchGithubRepo` server-only.
  The reusable on-ramp for new games (meteor, rhythm-tower, etc. — not local).
- **Single-object 3D editor** (`/editor`, foundation of roadmap C). Pick a library MODEL asset →
  orbit + TransformControls (translate/rotate/scale, orbit suspended mid-drag) + recolor (clones
  materials, library untouched) + reset + Download edited GLB. Reuses the GLBViewer IBL + normalize.
  **Scene-layout/multi-object composition is the next phase.** Needs a click-test (interactive UI).
- **More games onboarded as projects:** woodturning-studio (local, R3F procgen lathe). Plus the
  earlier storm-break-hockey / corrupted-veil / fractured-domains. 6 projects total.
- +13 tests (github + library/import helpers). Gate: typecheck 0 · lint 0 · test 103 · build 0.

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
