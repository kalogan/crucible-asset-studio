# Crucible — Asset Studio

A generalized, **multi-game asset-generation studio**. Point it at a game → it
co-develops that game's **canon** (art bible → prompt scaffolding → trained LoRA),
generates assets in that canon (2D → 3D), finishes them, and publishes them to a
per-project CDN the game references. One studio, many games, each with its own
enforced visual identity.

**The core inversion:** the **canon is the first-class domain object**; generation is
a *consumer* of it. Style is the foundation, not a feature.

> Rebuild + generalization of the March 2026 "Living Asset Forge" prototype. The
> debugged generation kernel was mined into [`KERNEL_LESSONS.md`](KERNEL_LESSONS.md)
> and reimplemented clean — never copied.

## What works today

- **Multi-game from line one** — projects + canons are first-class; everything is project-scoped.
- **Canon engine** — per-game style guide (palette, prompt prefix/suffix, do/never) that
  scaffolds every prompt. Auto-draft a canon from a game's art bible (Claude), or hand-author it.
- **Generation** — Claude-enriched (subject-only, canon-aware) **FLUX** text→image →
  background cutout → **TRELLIS** image→3D, behind a data-driven executor-adapter.
- **2D-review-before-3D** — generate the cheap 2D image first (~$0.003), review it, and only
  pay for the expensive 3D step (~$0.08) on the ones you like.
- **Review queue** — orbitable GLB viewer (2D images shown inline) with approve / reject.
- **Cost guardrails** — per-run estimate, daily cap (`CRUCIBLE_DAILY_COST_CAP`),
  single-in-flight lock, cancel-on-timeout. Replicate dashboard spend limit is the hard backstop.
- **Live status** — a stage stepper (image → cutout → model → saving) with an elapsed timer.

See [`STATUS.md`](STATUS.md) for current state + the roadmap (style fidelity via
nano-banana / LoRA, then batch worker + Kiln + CDN, then the two-game proof).

## Stack

- **Next.js (App Router) + TypeScript** — unified server/client; provider keys stay server-side.
- **Supabase** — Postgres (project-scoped, single-user, no RLS) + Storage.
- **Replicate** — FLUX (text→image) + TRELLIS (image→3D), behind an executor-adapter kit.
- **react-three-fiber + drei** — GLB review viewer (self-contained IBL).
- **Zod** — runtime-validated row schemas (the source of types).

## Setup

```bash
pnpm install
cp .env.example .env.local      # Supabase URL + anon + service-role; REPLICATE_API_TOKEN;
                                # optional ANTHROPIC_API_KEY; DATABASE_URL (for migrations)
pnpm migrate                    # apply supabase/migrations/*.sql (idempotent, tracked)
pnpm dev                        # http://localhost:3000
```

Then: create a project → **Canon** (seed/auto-draft a canon) → **Generate** (Image only or
Straight to 3D) → **Review**.

> ⚠️ Generation spends real money on Replicate. Set a spend limit in the Replicate
> dashboard and keep `CRUCIBLE_DAILY_COST_CAP` sane.

## The gate (run before every commit)

```bash
pnpm typecheck   # tsc --noEmit (strict, noUncheckedIndexedAccess)
pnpm lint        # next lint + jsx-a11y
pnpm test        # vitest
pnpm build       # next build
# or: pnpm gate  (all four)
```

WCAG 2.1 AA + mobile-first are gated constraints, not polish. **Don't run `pnpm build`
while `next dev` is live** — it clobbers the shared `.next` and 500s the dev server.

## Layout

```
app/            Next.js routes + server actions (/, /generate, /review, /canon, /intake)
components/     UI (projects, generate, review viewer, canon, intake)
lib/
  schema/       Zod row mirrors of the DB (+ golden fixtures)
  db/           server-only data-access layer (parses results through Zod)
  executor/     Replicate/TRELLIS adapter (routing, retry/backoff, poll, persist)
  canon/        prompt scaffolding, precision bar, seeds
  pipeline/     2D / full-3D / convert-to-3D orchestration
  budget.ts     cost guardrails
supabase/migrations/   SQL schema (projects, canons, asset_specs, batches, jobs, assets, storage)
scripts/migrate.mjs    pg-based migration runner
docs/           the full spec + methodology (see below)
```

## Docs

- [`docs/HANDOFF_crucible.md`](docs/HANDOFF_crucible.md) — project brief + build spec
- [`docs/CANON_INTAKE.md`](docs/CANON_INTAKE.md) — per-game canon process + two-path LoRA spec
- [`docs/WAYFINDER_ART_BIBLE.md`](docs/WAYFINDER_ART_BIBLE.md) — a completed canon example
- [`docs/ARCHITECT_BUILDER_PIPELINE.md`](docs/ARCHITECT_BUILDER_PIPELINE.md) — the orchestration methodology this is built with
- [`docs/PREVIEW_HARNESS.md`](docs/PREVIEW_HARNESS.md) · [`docs/HANDOFF_kit_registry.md`](docs/HANDOFF_kit_registry.md)
- [`KERNEL_LESSONS.md`](KERNEL_LESSONS.md) — the debugged generation kernel

_Single-user project. Built via the Architect/Builder pipeline._
