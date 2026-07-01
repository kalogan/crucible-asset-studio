# Audit + borrow plan — `majidmanzarpour/threejs-game-skills`

_Audited 2026-06-30. Source: https://github.com/majidmanzarpour/threejs-game-skills (MIT)._

## What it is

Nine **Claude Code agent skills** for three.js game dev (SKILL.md + reference docs + checklists +
helper scripts + subagent defs). They are **workflow/process** skills that orchestrate an agent to
build a game, and they lean on **paid generation APIs**: Tripo (3D), Google Gemini (image),
ElevenLabs (audio). This is **not a runtime code library** like our game-kit.

Skills: `game-director` (orchestrator), `gameplay-systems`, `aaa-graphics-builder`, `game-ui-designer`,
`debug-profiler`, `qa-release`, `3d-generator` (Tripo), `image-generator` (Gemini), `audio-generator` (ElevenLabs).

**Where the value is:** the provider-agnostic **quality checklists/gates**, a few concrete
**gap-fillers** (headless canvas QA, physics guidance), and a **meta-idea** (package our kit as skills).
The paid-API scripts are the least reusable part (their keys, Python, their providers).

## Map vs. Crucible today

- **We already have:** game-kit (25 runtime systems), the scaffolder (runnable Vite/r3f gen), `/brief`
  (design-brief generator), the asset pipeline (FLUX→TRELLIS image→3D, canon, LoRA enforcer), procgen
  audio bake, and a preview harness. → so `game-director` + `gameplay-systems` largely **overlap** us.
- **They have that we don't:** scored quality gates, headless-canvas visual QA, physics-engine guidance,
  mobile/touch-UI + safe-area patterns, auto-rig/animation (Tripo), real SFX/voice (ElevenLabs).

## Recommendation — borrow, tiered (fits the hub+framework north star)

### Tier 1 — Quality gates & checklists → fold into `/brief` + scaffolder + review. **HIGH value / LOW effort / no paid deps.**
Port the provider-agnostic checklists (MIT, with attribution): **AAA visual scorecard** (0–3 per
category, explicit premium/showcase gates), **new-game definition-of-done**, **playtest-QA**,
**release-risk**, **HUD-readability**, **responsive/mobile-input**, **perf-profile**, **material-lighting-quality**.
- `/brief`: emit a "Definition of Done" + "Visual scorecard" section in each generated design brief.
- scaffolder: emit a `DEFINITION_OF_DONE.md` + quality-gate checklist into generated projects.
- review page: a checklist/scorecard panel for grading an asset or scene.
This is the strongest fit — pure knowledge that upgrades the framework with zero new providers.

### Tier 2 — Concrete gap-fillers → new game-kit capabilities. **MED value / MED effort.**
- **Headless canvas QA** (`inspect-threejs-canvas.mjs`, Playwright): screenshot desktop+mobile, pixel +
  console inspection of a running canvas. Adopt the technique into the scaffolder's emitted project (a
  `pnpm qa` script) and our preview harness. (Verify/add `@playwright/test` + `pngjs`.)
- **Physics**: game-kit has `nav` + `behavior` but **no physics engine**. Add a physics adapter seam
  (default **Rapier**, per their selection ladder) as a game-kit system; keep the selection doc as reference.
- **Mobile/touch UI + safe-areas**: extend game-kit `hud` with touch controls + safe-area patterns.
- **Debug/profiler**: a game-kit `stats`/perf overlay system + the perf-profile checklist.

### Tier 3 — Asset-gen provider adapters → **OPTIONAL, paid, secondary to the refine/upscale arc.**
- **Tripo** (text/image-to-3D with **auto-rigging + animation retarget + stylization**): fills a real gap —
  TRELLIS yields **static** meshes with no rig/anim. If we ever want rigged/animated characters (LD has
  enemies/players), Tripo does what TRELLIS can't. Borrow the **adapter pattern** behind our executor; gate
  behind a spend decision.
- **ElevenLabs** (real SFX + TTS voice): we only have procgen synth bake. Real SFX/voice is a gap — same
  optional-adapter treatment.
- Per the north star, asset-gen is opportunistic and the **refine/upscale** pipeline is primary; these are
  "when you want them," not now.

### Don't borrow
- `game-director` orchestrator + `gameplay-systems` scaffold — overlap our Architect/Builder pipeline + scaffolder.
- `agents/openai.yaml` — OpenAI/codex format, not our stack.
- The paid Python API scripts as-is — reimplement the adapter pattern in our executor if we adopt Tier 3.

## The bigger idea (the real borrow)
The **format**: game-dev capability packaged as **composable agent skills**. Our north star is a
hub + framework — we could expose game-kit + scaffolder + `/brief` (+ the Tier-1 checklists) as a
"crucible game skills" set so a CLI agent builds games with our kit. That's a framework play larger
than any single checklist, and this repo is the reference implementation of the pattern.

## Suggested sequence
1. **(now, cheap)** Tier-1 checklists → `/brief` + scaffolder DoD + review scorecard. MIT attribution.
2. Headless canvas QA into the emitted project + preview harness.
3. Physics adapter seam (Rapier) + mobile/touch HUD as game-kit systems.
4. **(on a spend decision)** Tripo / ElevenLabs adapters behind the executor.
5. **(strategic)** Evaluate packaging game-kit as agent skills.

## License
MIT — reuse permitted with attribution. Keep a credit/NOTICE when porting checklists or reference docs.
