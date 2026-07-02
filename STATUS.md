# Crucible — build status

_Current state only. For dated history (session logs, shipped features, slice/commit tables), see_
_[CHANGELOG.md](./CHANGELOG.md). For the original brief/kickoff docs (historical, superseded), see `docs/`._

Crucible is a studio-operations hub + reusable framework (game-kit / app-kit) for Kevin's game and
app projects — dashboard, asset library/versioning, and a character/asset generation pipeline, all
built to make the *kit* better, not to be a standalone asset-gen product.

## North star + Strategy (2026-07-02, locked)

**Audience, in order:** Kevin (daily driver) → portfolio demo (shows well to strangers) → friend-tryable
(a link a friend can actually open and play). Deployed URLs matter; npm publishing does not.

**3-month goal: 2-3 games built on the kit.**
1. **GYRE** — full 15-min demo, deployed.
2. A small 3D game, built identity-token-driven (proves the anti-sameness fix generalizes).
3. A 2D mobile game (the 2D arm, now in scope).

**Work modes:** sync taste-loop (pairing in real time) for anything game-feel; AFK+queue (delegate,
check back later) for infra/plumbing. **Gate:** CI running on both this repo and each game repo.

## Arm sequencing

- **NOW:** finish GYRE's demo (W1 Still Point ✅ · W2 shell ✅ · W3 endings in flight); identity-token
  module ✅ WIRED into the scaffolder; start the 2D-mobile arm (build list now includes a **touch layer
  for 3D games** — virtual stick + touch-look + tap-interact; GYRE is desktop-only today).
- ✅ **`cutscene` kit module SHIPPED (2026-07-02):** deterministic shot-sequence player (camera keyframes +
  easing, named ramp tracks, exactly-once events, skip-safe) + r3f `<CutscenePlayer>`. 28 tests. First
  consumer: GYRE's W3 endings (in flight). Grow the vocabulary from consumer feedback.
- ✅ **`layout` kit module v1 SHIPPED (2026-07-02; Director-locked design, see memory `project-layout-kit`):**
  authored multi-floor interiors — **volumes + portals** descriptor (floors, rect/poly volumes, door/stair/
  **atrium-void** portals, spawn + named exits as the "area" seam), `validateLayout` (full error list),
  `buildLayoutGeometry` (slabs rect-decomposed around voids, walls with door gaps, stair runs),
  `layoutBounds` (GameCamera-compatible collision), `<LayoutGreybox>`. 37 tests. Origin: the
  deceive-me-daddy multi-floor/atrium experiments. **Data-first now → Crucible 2D-canvas-per-floor editor
  later** (same format; editor needs: live validation UI, a pick/hit-test helper, real poly support —
  polys are rect-hulled in v1). **Roadmap: full spatial runtime** (navgrid, spawns, door logic, room-enter
  events) when a game needs it. **First application: GYRE post-demo** — an open-world map (the `world`
  module, stitched via the area seam) contrasted with authored interior levels.
- **NEXT (deliberate paid pass):** the reference-driven refine/upscale pipeline (procgen asset → render →
  reference-conditioned img2img/upscale → TRELLIS → derived asset via `source_asset_id`).
- **AFTER THE SLATE (parked, not deleted):** LoRA training, Kiln finishing + CDN publish, Roblox
  round-trip (web→Roblox emit exists; Roblox→web import doesn't), app-kit auth/starter variants,
  kit-registry visualization, reverse-sync (Crucible-initiated pull from a game).

## Current state

**Hub/dashboard:** multi-project studio (games + apps, `kind` discriminator). Dashboard = stat row
(Games/Apps/Commits/Assets) + cards (Type/Tech/Genre chips, GitHub last-update, Play CTA), sorted by
last GitHub update. GitHub sync is DB-stored (`pnpm import-repos` / `pnpm refresh-github`), not
live-fetched — dashboard needs no server `GITHUB_TOKEN`. Left sidebar: Home·Creations / Assets(Library·
Systems) / Tools(Editor·Biome·Roblox) / Framework(Kit·Brief·NPC·Sample). Per-project workspace nested
under `/projects/[slug]/*`.

**Generation + canon:** canon-first prompt scaffolding (style) + per-asset-type framing (format), 2D-
review-before-3D (Image-only ~$0.003 vs Straight-to-3D ~$0.09), Nano Banana (Gemini) reference-conditioned
provider alongside FLUX, cost guardrails (daily cap, single-in-flight). Resumable batch worker
(`enqueueBatch`/`runBatch`, dry-run-by-default, paid path double-gated).

**Library + versioning:** `/assets` global library, live 3D tiles (shared WebGL context), focus modal
(orbit/zoom/metadata/notes/download), origin tags. Asset **versioning Phase 1 shipped**: re-syncs keep
history (not overwrite), content-hashed storage paths, AssetModal version flipper (‹ v_n/total ›, "Make
current" rollback). Audio is a first-class `AssetKind` (procgen synth → baked WAV, recipe-editable).

**game-kit (vendored into `vendor/game-kit`):** 25 systems (prng/settings/scene-state/lighting/postfx/
audio/hud/anim/geo/palette/artkit/input/save/math/camera/render/presets/fx/net/clip/nav/npc-behavior/
npc-reasoning/brief/world), r3f variants for the render-facing ones. `/kit` scaffolder generates a
runnable Vite/Next starter (system picker + templates incl. `moody-explorer`, GitHub-bootstrap script,
zip download). `/brief` (Architect agent → design brief → prefills the scaffolder). NPC brain has
memory v2 (durable store, summarization, semantic recall) + gated B5 reasoning→movement bridge
(`allowMovement:true` opt-in; the LLM proposes a goal, the deterministic pathfinder still owns motion).

**Character pipeline:** 2D art-bible generation (LD-forge-parity, canon-driven) → TRELLIS img→3D →
**UniRig** ML auto-rig (skeleton+skin, replaced the hand-rolled Blender skinner that produced "taffy"
limbs) → `unirig_clips.py` authors an 11-clip set (idle/walk/run/jump/dodge/use/death/cast/guard/strike)
in world-space, roll-independent. `auto-rig.mjs` defaults to the UniRig engine end-to-end. Riggability
pre-check (`lib/rig/riggability.ts`) warns (never blocks) on risky topology; A-pose is now the recommended
rig-ready framing. Reusable across games via canon-driven forge + game-kit clip-player.

**GYRE** (`web-projects/gyre`, first real game built ON the kit): playable descent + battle loop, all 11
character clips wired (idle/walk/run/jump/dodge/use/strike/guard/cast/death), `?anim` animation lab +
live per-clip speed tuning panel. Harvested its bespoke glue back into game-kit (`GameCamera`,
`GltfModel`, `useSceneMachine`, sampled audio, npc zod-free runtime) — net −104 lines in GYRE itself.
Remaining for the 15-min demo: the 3-Wills choice (C2), battle feel/juice + dread music (C3).

## Live gate

**typecheck 0 · lint 0 · tests 409/409 · CI: GitHub Actions on both repos** (Crucible `main`,
GYRE `master`: typecheck → lint/test → build, per-step timeouts, no secrets). Verified 2026-07-02.
_(Snapshot — keep this line honest every session; a count drop with a "green" claim means tests vanished.)_

## How to run

`pnpm dev` → http://localhost:3000. Generate → pick **Image only** (~$0.003, review first) or
**Straight to 3D** (~$0.09). Generation spends real money (Replicate); the Replicate dashboard spend
limit + the in-app daily cap (`CRUCIBLE_DAILY_COST_CAP`, default $5) are the backstops.

## Known boundaries / follow-ups

- **Verify the TRELLIS version hash** (`lib/executor/models.ts`) against Replicate before trusting 3D
  output (KERNEL_LESSONS §1).
- **Generation is synchronous (~2 min/asset).** Fine locally; prod/bulk uses the resumable batch worker
  (Vercel function timeouts otherwise).
- **Don't run `pnpm build` while `next dev` is live** — it clobbers `.next` and 500s the dev server. Stop
  dev, gate, restart.
- Riggability is set upstream by the 2D input pose, not by a TRELLIS flag — a genuinely non-humanoid
  design never rigs perfectly to a humanoid skeleton (design choice, not a pipeline bug).
