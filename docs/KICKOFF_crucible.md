# Crucible — kickoff prompt

*(Paste this as the opening message to the build agent. Adjust file paths to match the project.)*

---

You are building **Crucible** — a generalized, multi-game asset-generation studio. It reads what a game is about, co-develops that game's **canon** (art bible + trained LoRA), generates and finishes assets in that canon, and publishes them to a per-project CDN the game references. It is the rebuild and generalization of the March "Living Asset Forge" prototype.

**Do not start coding or rewriting yet.** Read the documents below, confirm your understanding back to me, and produce one artifact (`KERNEL_LESSONS.md`) first. I'll review before you build.

## Read these first, in this order

1. **`HANDOFF_crucible.md`** (v2) — the project brief + full build spec. This is your primary source of truth: architecture, data model, modules, build order, acceptance milestone.
2. **`CANON_INTAKE.md`** — the required companion. The per-game art-bible questionnaire (auto-draft → grill → refine), the precision bar that gates generation, and the two-path LoRA training spec. Crucible's canon engine and intake are *operationalized* by this doc.
3. **`ART_BIBLE.md`** (Wayfinders) — a *completed, approved* canon, and your reference example of what a finished art bible looks like. It also points to `docs/ART_SPEC.md` (poly budgets, rig, export) and `docs/ENVIRONMENT-ART-PIPELINE.md` — read those for the technical asset constraints generated models must obey.
4. **`HANDOFF_kit_registry.md`** — the tools/kits/systems framework and registry. Crucible must be **built from existing kits**, not re-coded. Specifically reuse the **GLBViewer kit** (review) and the **executor-adapter kit** (generation calls).
5. **`ARCHITECT_BUILDER_PIPELINE.md`** — my architect/builder orchestration. Crucible should be scaffolded and built *through* this orchestration, and must honor its conventions (e.g. WCAG AA + mobile-first UI per §5c).
6. **Preview harness** *(system)* — reuse it for in-app asset preview rather than building a new viewer surface.
7. **`_reference/march-asset-forge/`** — the old source, **READ-ONLY**. Reference for debugged logic only. Do **not** copy or import from it wholesale; reimplement clean.

## Non-negotiables (before any code)

- **Reference the kernel, rebuild the shell.** The old single-file/localStorage foundation is being replaced. But the *debugged kernel* (Replicate version-hash-vs-endpoint routing, null-URL serialization fix, rate-limiting, TRELLIS wiring, the LoRA workflow that worked) must be preserved by reimplementing it correctly — not rediscovered by trial and error, and not copy-pasted.
- **Multi-game from line one.** `project` and `canons` are first-class in the schema. No single-project assumptions, no localStorage as source of truth.
- **The canon is a gate.** No real-asset generation until a game's canon passes the precision bar in `CANON_INTAKE.md` §6 (concrete palette/hex, unambiguous render style, do/never rules, a validated LoRA).
- **Build from kits, run by orchestration.** GLBViewer kit + executor-adapter kit + preview harness; scaffolded via the architect/builder pipeline. Don't re-code what already exists in the registry.
- **Kiln stays seamed.** The finishing pass (retopo + baked PBR) is its own module consuming generation output — not tangled into the Replicate/TRELLIS code.
- **Avatars are deferred** to a later phase (separate rigging-ready pipeline). Don't let avatar complexity into the prop pipeline.

## Your first task (Phase 0 only)

1. Read everything above.
2. Reply with: (a) a 5–8 line confirmation of what Crucible is and the build order you'll follow, and (b) any contradictions or gaps you found across the docs.
3. Produce **`KERNEL_LESSONS.md`** by mining `_reference/march-asset-forge/` — the exact debugged behaviors to reimplement (Replicate routing, serialization fix, rate-limiting, TRELLIS params, the LoRA training/application steps).
4. **Stop and wait for my review.** Do not proceed to Phase 1 until I approve.

## Then proceed by the handoff's build order

Phase 1 (multi-game schema spine) → Phase 2 (canon engine, per `CANON_INTAKE.md`) → Phase 3 (bulk + Kiln finish + CDN publish) → **Phase 4 acceptance: the two-game proof** — produce finished, on-canon, published assets for **Wayfinders (animals, Path A — train on rendered turntables of real assets)** *and* the **deception game (train station, Path B — bootstrap a new noir canon from prompts)**, each with its own canon, folder, and CDN endpoint, zero style cross-contamination. Decompose the train station into props; build the shell as modular architecture + tileable textures, not image-to-3D.

## What I (the human) provide — ask me for these, don't guess

- **Canon intake answers:** when you run the intake grill, ask me; I answer. Don't invent a game's canon.
- **CDN host decision:** flag it at Phase 3 (Supabase Storage to start vs. Cloudflare R2 for real distribution).
- **Wayfinders reference screenshots:** 3–5 canonical shots as visual anchors when you set up its turntable-render dataset.
- **LoRA training host:** confirm with me (Replicate vs. RunPod/fal) before the first training run.

Start with Phase 0. Confirm understanding, surface gaps, write `KERNEL_LESSONS.md`, then stop.
