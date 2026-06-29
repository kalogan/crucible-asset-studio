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

**Last green gate:** typecheck 0 · lint 0 · **test 59** · build 0. Routes: `/`, `/generate`, `/review`, `/canon`, `/intake`.
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

### Later phases
- **Phase 3 — bulk + finish + publish:** resumable, cost-capped **batch worker** (sync gen is
  prod-unsafe at volume); **Kiln** finishing module (retopo + baked PBR); **CDN publish** + per-project
  manifest (Supabase Storage → R2 when distribution matters).
- **Phase 4 — two-game proof:** the **deception-game train station** as a second canon (Path B — intake
  auto-draft now works with the Anthropic key) → decompose into props; zero style cross-contamination.
- **Phase 5 — avatars** (deferred): rigging-ready character pipeline, separate from props.

### Smaller follow-ups
- **Intake "Save as canon"** — `/intake` currently drafts then links to `/canon`; wire a direct save so
  it's one flow (no copy-paste). Useful for the deception game.
- Verify TRELLIS version hash before heavy 3D use; migrate off deprecated `next lint`; rotate the old
  March Supabase anon key.
