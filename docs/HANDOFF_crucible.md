# PROJECT BRIEF & HANDOFF: Crucible

**Version:** v2 (adds explicit linkage to the canon-intake process)
**Owner:** Kevin (single-user, forever)
**Companion (required):** `CANON_INTAKE.md` — the per-game art-bible questionnaire + LoRA training spec. Crucible's canon engine and game-context intake (§3, Phase 2) are *operationalized* by that doc. Feed both into the project together.
**Supersedes / absorbs:** `HANDOFF_assetforge_pipeline.md` (its batch/review/promotion concepts are rebuilt cleanly inside Crucible, not extended onto old Asset Forge)
**References:** March 2026 "Living Asset Forge" (read-only, as the debugged-kernel source — see §1)
**Runs on:** the always-on mini PC (headless Linux, Tailscale) — same box as the agent swarm and kit registry
**Intended consumer:** a fresh Claude Code project

---

## PROJECT BRIEF

**What Crucible is:** a generalized, multi-game **asset-generation studio**. Point it at any game → it co-develops that game's **canon** (style guide + trained LoRA) → generates and finishes assets in that canon → publishes them to a CDN the game references. One studio, many games, each with its own enforced visual identity.

**Why it exists:** March's Living Asset Forge proved the magic for *one* game — that a per-game art style + LoRA produces *consistent* output, not generic one-offs. Crucible generalizes that proven idea into reusable tooling for *every* project. The value was never the Replicate plumbing; it's the **style/canon enforcement that makes a game's assets look like they belong to one world.**

**Why rebuild instead of extend:** March Asset Forge is a single-file React app with localStorage state and a one-project assumption baked in. Crucible's requirements — many games, project-scoped folders, CDN publishing, orchestration integration, a finishing pass — fight that foundation on every feature. Critically, Crucible can now be **built from Kevin's own kits and scaffolded by his architect/builder orchestration**, which didn't exist in March. This is the same idea re-expressed on a platform that now exists, with two quarters more skill. It is a rebuild of the *shell*, not a re-derivation of the *kernel* (§1).

**The core inversion:** March Asset Forge was a generation tool that *had* a style feature. Crucible makes the **canon (style guide + LoRA) the first-class domain object**, and generation a *consumer* of it. Style is the foundation, not a feature.

**Naming:** **Crucible** = the platform (raw generation + the game's canon fuse under pressure into something coherent and refined). **Kiln** = the finishing module *inside* Crucible (fires rough generated meshes to a finish: retopo + baked PBR). Crucible is the studio; Kiln is one stage in it.

**North star (acceptance test):** Crucible is "done" for v1 when it produces finished, on-canon assets for **two** distinct games — **Wayfinders (animal assets)** and the **deception game (train station)** — each with its own canon, its own project folder, and its own CDN endpoint. Two games, not one, because the entire point is generalization.

---

## 1. Reference the kernel, rebuild the shell (do this FIRST)

March Asset Forge holds hard-won, debugged knowledge. Do **not** copy its code; **mine** it.

- Place the old source read-only at `_reference/march-asset-forge/` with a README: *reference for debugged logic only — reimplement clean, never copy wholesale.*
- **First build task:** produce `KERNEL_LESSONS.md` extracting the non-obvious debugged knowledge, so v2 reimplements it right the first time:
  - Replicate **version-hash vs. model-endpoint routing** (the thing that bit you).
  - **Null-URL serialization** fix.
  - **Rate-limiting** handling.
  - **TRELLIS** image-to-3D wiring (params, the firtoz/trellis specifics).
  - The **LoRA training + application workflow** that actually produced consistent output — captions, trigger words, training settings, how it was referenced at generation time.
- After `KERNEL_LESSONS.md` exists, `_reference/` is a lookup backstop only. The build proceeds from the lessons doc + this spec, not from the old code.

---

## 2. Non-Goals / Guardrails

- **Don't resurrect the old foundation.** No single-file app, no localStorage as source of truth, no one-project assumptions. Multi-game from line one.
- **Don't rebuild the debugged kernel from scratch.** Reference `KERNEL_LESSONS.md`; reimplement those specific behaviors cleanly, don't rediscover them by trial and error.
- **Don't copy from `_reference/`.** Reimplement. The folder is a spec, not a parts bin.
- **Avatars are deferred** to a later phase (separate rigging-ready pipeline — §8). Don't let avatar complexity bleed into the prop pipeline.
- **Keep generation and finishing (Kiln) seamed.** Kiln is a distinct module consuming generation output, not tangled into the Replicate/TRELLIS code.
- **Single-user.** Supabase, no RLS, no auth complexity.
- **Reuse, don't re-code, your kits.** GLBViewer is the registry kit; the Replicate call is the executor-adapter kit; don't hand-rewrite them.

---

## 3. Architecture (modules with clean seams)

```
  game repo/design doc
        │
        ▼
 ┌─────────────┐   ┌──────────────┐   ┌─────────────┐   ┌──────┐   ┌────────┐   ┌─────────┐
 │ Game-context│──▶│ Canon engine │──▶│ Generation  │──▶│ Kiln │──▶│ Review │──▶│ Publish │
 │   intake    │   │ style+LoRA   │   │ FLUX/TRELLIS │   │finish│   │GLBView │   │  CDN    │
 └─────────────┘   └──────────────┘   └─────────────┘   └──────┘   └────────┘   └─────────┘
        the canon is the source of truth; every later stage reads it
        all of the above is project-scoped: every record hangs off a `project`
```

- **Game-context intake** — point it at a game's repo/README/design doc; Claude auto-drafts a canon, then **grills** the user to fill gaps until the precision bar is met. **Full process + questionnaire + starter question bank: see `CANON_INTAKE.md` §1–§3.** (This is the "integrative / co-develops the style guide" ask.)
- **Canon engine** *(the core domain)* — manages each game's **style profile** (palette, prompt scaffolding, references) and its **trained LoRA** (version, trigger word). Everything downstream reads the canon. **The intake→art-bible→LoRA derivation and the two-path training spec live in `CANON_INTAKE.md` §4–§6; a canon is not generation-ready until that doc's §6 bar passes.**
- **Generation** — text→image (FLUX/SDXL) and image→3D (TRELLIS), behind the **executor-adapter kit** (per-job Replicate now; rented-box batch later). Always loads the project's canon + LoRA.
- **Kiln** *(finishing pass)* — takes rough generated meshes to a finish: retopology, baked normal/roughness/metallic (PBR) maps. The "uplevel from prototypy" engine for props. Layered after generation, never inside it.
- **Review** — the **GLBViewer kit**; approve / reject-and-reprompt.
- **Publish** — push approved, finished assets to a **per-project CDN endpoint** with a stable **manifest** the game fetches. (This is the deception game's "just consume finished GLBs" path.)

---

## 4. Data Model (Supabase, single-user, project-scoped)

`project` is first-class; everything hangs off it. (Schema below extends the Asset Forge pipeline model with `projects` + canon + CDN fields.)

```sql
projects
  id            uuid pk
  slug          text unique        -- "wayfinders", "deception-station"
  name          text
  context_ref   text               -- repo URL / design-doc path used for intake
  cdn_endpoint  text               -- per-project CDN base URL
  created_at    timestamptz

canons                              -- the core domain object (per-game style + LoRA)
  id              uuid pk
  project_id      uuid fk -> projects
  name            text             -- "Wayfinders core", "noir station"
  style_guide     jsonb            -- palette, rendering conventions, do/don'ts
  prompt_prefix   text
  prompt_suffix   text
  negative_prompt text
  reference_imgs  jsonb
  lora_ref        text null        -- trained LoRA file/version
  lora_trigger    text null
  lora_status     text             -- 'none'|'training'|'ready'
  created_at      timestamptz
  updated_at      timestamptz

asset_specs                         -- what to generate (the plan)
  id            uuid pk
  project_id    uuid fk -> projects
  canon_id      uuid fk -> canons
  catalog_key   text               -- "prop.station.ticket_booth"
  asset_type    text               -- 'sprite'|'texture'|'model_3d'|'icon'|'avatar'
  title         text
  prompt        text
  params        jsonb
  source_asset_id uuid null         -- 2D->3D chaining
  priority      int default 0

batches  (project_id, name, status, cost_estimate, cost_actual, timestamps)
jobs     (batch_id, spec_id, status, attempt, executor, provider_ref,
          recipe_snapshot jsonb, error, cost, timestamps)   -- recipe_snapshot freezes model+prompt+seed+params+lora

assets                              -- produced asset moving through lifecycle
  id              uuid pk
  project_id      uuid fk -> projects
  spec_id         uuid fk -> asset_specs
  job_id          uuid fk -> jobs
  stage           text             -- 'in_review'|'approved'|'rejected'|'finished'|'published'
  raw_path        text             -- generation output
  finished_path   text null        -- Kiln output
  cdn_url         text null        -- after publish
  recipe_snapshot jsonb            -- full reproducibility (incl. canon + lora version)
  timestamps...
```

Lifecycle: `queued → generating → in_review → approved → finished (Kiln) → published (CDN)`; `rejected → re-queue`.

---

## 5. CDN / Publish (recommendation)

The game needs **public, finished assets at a stable URL** — so a private mini-PC-over-Tailscale host is wrong for distribution (players can't reach it). Options:

- **Cloudflare R2 + CDN** — *recommended.* Cheap/zero egress, global CDN, S3-compatible, per-project buckets/prefixes map cleanly to `projects.cdn_endpoint`. Best fit for "games reference a CDN."
- **Supabase Storage** — simplest, matches existing stack, public buckets per project. Fine to start; fewer CDN knobs than R2.
- **Vercel** — workable if assets ship with a web build, but less natural for a shared asset CDN across games.

Publish writes each approved+finished asset to `projects.cdn_endpoint/<catalog_key>` and updates a per-project **`manifest.json`** the game fetches to resolve assets by `catalog_key`. Start on Supabase Storage if you want zero new infra; move to R2 when distribution matters.

---

## 6. Built from your kits, run by your orchestration

- **GLBViewer kit** (registry) for review — don't re-code it.
- **executor-adapter kit** for the Replicate/generation calls.
- **Batch worker** runs as a tmux/systemd service on the mini PC (resumable, cost-capped) — same pattern as the Asset Forge pipeline handoff.
- The **architect/builder swarm** scaffolds Crucible module by module. This rebuild doubles as a showcase of the kit/orchestration system.

---

## 7. The two-game proof (acceptance milestone)

Platform-first, then validated by running **both** games through it:

- **Wayfinders — animals:** its own canon (existing Wayfinders style + LoRA), project folder, CDN endpoint; generate a set of animal assets.
- **Deception game — train station:** a *new* noir/period canon; project folder; CDN endpoint. **Decompose the station into props** the pipeline handles well (ticket booth, benches, departure board, clock, turnstiles, signage, lamps) — generate each as an individual 3D prop. Do **not** image-to-3D the building shell; build that as modular architecture + **tileable 2D textures** (image-half of the pipeline) and assemble props onto it in kitbashing. Each prop prompt: `"<prop>, <deception canon>, isolated object, neutral background"`.

Crucible passes v1 when both games produce finished, on-canon, published assets with zero cross-contamination of style.

---

## 8. Build Order

**Phase 0 — Kernel mining**
1. `_reference/march-asset-forge/` (read-only) → produce `KERNEL_LESSONS.md` (§1).

**Phase 1 — Platform spine (multi-game from line one)**
2. Supabase schema (§4) with `projects` + `canons` first-class. No localStorage source of truth.
3. Project switcher + per-project folders in the UI.
4. Executor-adapter (from kit registry) wrapping the Replicate/TRELLIS calls per `KERNEL_LESSONS.md`.
5. Generation → `in_review` for a single hand-entered spec, end to end, scoped to a project.

**Phase 2 — Canon engine (the core)** — *implement per `CANON_INTAKE.md`*
6. Style-profile CRUD + prompt scaffolding merged into the recipe. (`CANON_INTAKE.md` §4)
7. Game-context intake → auto-draft from docs, then grill to fill gaps; enforce the precision bar before a canon is usable. (`CANON_INTAKE.md` §1–§3, §6)
8. LoRA workflow — support **both** training paths (existing reference art / bootstrap-from-prompts), caption schema, and the post-train validation battery; recipe freezes the LoRA version. (`CANON_INTAKE.md` §5)

**Phase 3 — Bulk + finish + publish**
9. Batch queue + worker (resumable, cost-capped) for bulk add.
10. **Kiln** finishing module (retopo + baked PBR) as a post-approval stage.
11. Review (GLBViewer kit) approve/reject-reprompt.
12. Publish to CDN + per-project manifest (§5).

**Phase 4 — Two-game proof (acceptance)**
13. Run Wayfinders animals + deception train station through end to end (§7).

**Phase 5 — Avatars (deferred)**
14. Separate rigging-ready character pipeline (consistent proportions, animation-ready topology) — explicitly *not* TRELLIS-prop generation. Tackle only after props look finished.

---

## 9. Open Decisions (resolve in-session)

- **CDN host:** Supabase Storage (start simple) vs. Cloudflare R2 (recommended for real distribution).
- **Kiln depth:** how far to push auto-finishing (retopo + bake) vs. flag-for-manual-finish; start with PBR bake, add retopo if needed.
- **LoRA training host:** Replicate vs. RunPod/fal for the training step.
- **Intake scope:** how much the game-context intake auto-drafts vs. you author the canon by hand from its suggestions.
- **Avatar pipeline approach (Phase 5):** purpose-built character generator vs. a riggable base-mesh + style transfer — decide when you reach it.
```
