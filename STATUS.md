# Crucible — build status

_Durable status for the Architect/Builder pipeline (write → persist → notify)._

## Where we are

**Phase 0 — kernel mining:** ✅ done (`KERNEL_LESSONS.md`).
**Phase 1 — platform spine:** ✅ code-complete, gate-green, pushed. **Live run pending your keys.**

| Slice | What | Commit |
|---|---|---|
| S0 | Next.js + TS scaffold, strict, Tailwind, ESLint+a11y, Vitest, Supabase clients | `74ab20c` |
| S1 | Multi-game schema (6 tables) + Zod mirrors + server-only DAL + golden fixtures | `a5a2b51` |
| S3 | Executor-adapter (Replicate/TRELLIS kernel: routing, null-strip, 429-backoff, poll, persist) | `42aaccd` |
| S4 | Accessible GLB review viewer (r3f + drei) | `d576ab0` |
| S2 | Project switcher (create/select, cookie-backed active project) | `9d43079` |
| S5 | 2D→3D vertical slice → `in_review` + review queue (approve/reject) | `fb33562` |

**Last green gate:** typecheck 0 · lint 0 · **test 47** · build 0. Routes: `/`, `/generate`, `/review`.
**Runtime smoke:** all routes 200 in the no-keys (setup-notice) state; clean server log.

## To activate (Director — Supabase + keys)

1. **Create `.env.local`** from `.env.example` with the fresh Supabase project URL + anon + service-role keys, plus `REPLICATE_API_TOKEN` and (optional) `ANTHROPIC_API_KEY`.
2. **Apply the schema:** in the Supabase dashboard SQL editor, run `supabase/migrations/0001_init.sql` then `0002_storage.sql` (creates the public `assets` bucket). (Or wire the Supabase CLI later.)
3. `pnpm dev` → http://localhost:3000 → create a project → **Generate an asset**.
   - ⚠️ **The first generate spends real money** (Replicate FLUX + TRELLIS ≈ $0.09, + Anthropic if enriching). This is the §8 money boundary — it runs only when you click Generate.
4. It lands in **/review** as an `in_review` GLB you can orbit, download, approve/reject.

## Known boundaries / follow-ups

- **Verify the TRELLIS version hash** (`lib/executor/models.ts`) against Replicate before trusting 3D output (KERNEL_LESSONS §1).
- **Generation is synchronous (~2 min/asset).** Fine locally; **prod/bulk needs the resumable batch worker — Phase 3** (Vercel function timeouts).
- **DB-backed paths are unverified** until keys exist (the smoke only covered the no-keys path).
- `next lint` is deprecated in Next 16 — migrate to the ESLint CLI eventually (non-blocking).
- Rotate the old March Supabase anon key (it's in that repo's history).

## Next: Phase 2 — canon engine

Style-profile CRUD + prompt scaffolding → intake grill → two-path LoRA (per `CANON_INTAKE.md`). The canon precision bar gates real (non-canon-free) generation.
