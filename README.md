# Crucible — Asset Studio

A generalized, multi-game **asset-generation studio**. It co-develops each game's
**canon** (art bible + trained LoRA), generates and finishes assets in that canon,
and publishes them to a per-project CDN. See [`docs/`](docs/) for the full spec
(`HANDOFF_crucible.md`, `CANON_INTAKE.md`) and [`KERNEL_LESSONS.md`](KERNEL_LESSONS.md)
for the debugged generation kernel mined from the March prototype.

## Stack

- **Next.js (App Router) + TypeScript** — unified server/client; provider keys stay
  server-side (route handlers / server actions).
- **Supabase** — Postgres (project-scoped, single-user, no RLS) + Storage.
- **Replicate** — FLUX (text→image) + TRELLIS (image→3D), behind an executor-adapter.
- **react-three-fiber** — GLB review viewer.

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase + provider keys
pnpm dev                     # http://localhost:3000
```

## The gate (run before every commit)

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # next lint + jsx-a11y
pnpm test        # vitest (record counts)
pnpm build       # next build
# or: pnpm gate  (all four in sequence)
```

## Build status

Phase 1 (platform spine) in progress — schema, project switcher, executor-adapter,
GLB viewer, and the 2D→3D vertical slice. Orchestrated via the
[Architect/Builder pipeline](docs/ARCHITECT_BUILDER_PIPELINE.md).
