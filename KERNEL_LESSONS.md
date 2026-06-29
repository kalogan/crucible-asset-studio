# KERNEL_LESSONS.md

*The debugged kernel of the March 2026 "Living Asset Forge," mined from
`_reference/march-asset-forge/living-dungeon-asset-forge/` so Crucible reimplements
the hard-won behaviors correctly instead of rediscovering them.*

> **Status:** Phase 0 deliverable. This is a *lessons* doc, not a parts bin — it
> records exact behaviors, params, and traps. Reimplement clean (multi-game,
> server-side keys, Supabase as source of truth). Do **not** copy the monolith.
>
> **Sources mined:** `api/replicate.js`, `api/replicate-poll.js`,
> `api/replicate-cancel.js`, `api/supabase-upload.js`, `src/lib/supabase.js`, and the
> 11.9k-line `src/LivingDungeonGenerator.jsx`. Line refs below point into that source.

---

## 0. The headline correction (read this first)

**There is no LoRA training or application code in the reference.** A full-text search
for `lora` / `safetensors` / `trainings` / trigger-word patterns returns nothing
generation-related. The forge's *style consistency* was achieved by **three other
levers**, not a trained LoRA:

1. **Art-bible system prompts** baked per game profile (`GAME_PROFILES`,
   `buildSystemTilesheets` / `buildSystemEnemies` / etc.) that force palette hexes,
   do/never rules, and the render style into every Claude-enriched prompt.
2. **A "style anchor" reference** (`goldenHint` / `STYLE ANCHOR (match closely)` in
   `enrichPrompt`, monolith ~L2420) — a known-good prior result fed back into prompt
   enrichment.
3. **img2img consistency** — FLUX Redux (`redux_image`) and FLUX Depth ControlNet
   (`control_image`, `control_strength: 0.45`) to lock a subject's structure across
   variants/frames (monolith ~L2440, ~L2562).

**Implication for Crucible:** the LoRA pipeline in `CANON_INTAKE.md` §5 (both training
paths, caption schema, validation battery) must be **built fresh** — it is *not* a
reimplementation of mined code. What *is* proven and worth preserving is the
**prompt-scaffolding + style-anchor + img2img** stack above; treat it as Crucible's
"pre-LoRA" consistency path and the bootstrap (Path B) seed-generation mechanism. The
brief's phrase "the LoRA workflow that worked" overstates what exists in code —
flagged for the Director.

---

## 1. Replicate routing: version-hash vs. model-endpoint (the thing that bit you)

**The trap:** Replicate has *two* prediction APIs and they are not interchangeable.
Sending a versioned model to the model-endpoint (or vice-versa) fails.

`api/replicate.js` resolves routing in this exact precedence:

| Caller passes | Endpoint used | Body shape | `Prefer: wait`? |
|---|---|---|---|
| explicit `version` hash | `POST /v1/predictions` | `{ version, input }` | no |
| `model` in `VERSIONED_MODELS` | `POST /v1/predictions` | `{ version: <pinned hash>, input }` | no |
| `model` in `MODEL_ENDPOINTS` | `POST /v1/models/{owner}/{name}/predictions` | `{ input }` | iff in `FAST_MODELS` |
| anything else | — | — | 400 "Unknown model" |

- **`firtoz/trellis` is versioned** and must go to the versioned endpoint with a pinned
  hash. The reference pins
  `4876f2a8da1c544772dffa32e8889da4a1bab3a1f5c1937bfcfccb99ae347251`
  (`api/replicate.js` L27-29). ⚠️ The monolith comment at L2478 claims "Latest version:
  fd7123e27245" — a **stale/contradictory note**. Re-verify the live TRELLIS version
  hash on Replicate before first use; pin it explicitly and snapshot it into the job's
  `recipe_snapshot`.
- **Fast models** (`flux-schnell`, `flux-redux-schnell`, `lucataco/remove-bg`) set
  `Prefer: wait` to respond synchronously (~<60s), avoiding a poll loop entirely.
- **Models mined as in use:** `black-forest-labs/flux-schnell` (txt2img),
  `black-forest-labs/flux-redux-schnell` (img2img consistency),
  `black-forest-labs/flux-depth-dev` (versioned, depth ControlNet — passed as the 4th
  `version` arg, model=null; monolith L2568), `nightmareai/real-esrgan` (upscale),
  `lucataco/remove-bg`, `meta/musicgen`, `firtoz/trellis`.

**Crucible reimplementation:** make this a small, data-driven **executor-adapter**
(per the kit registry) — a model registry mapping `name → {kind: 'endpoint'|'versioned',
hash?, fast?}` — not an if-ladder. Freeze the resolved `{model|version, input}` into
`recipe_snapshot` for reproducibility.

---

## 2. Null / undefined serialization (Replicate rejects null fields)

There is no single comment labeled "null-URL serialization fix," but the codebase
consistently applies the underlying discipline — **never serialize a null/undefined
field into a Replicate request body**, because Replicate 422s on e.g. `version: null`:

- `startReplicatePrediction` conditionally spreads the version:
  `{ apiKey, model, input, ...(version ? { version } : {}) }` (monolith L2373-2378) —
  a null version is *omitted*, not sent.
- The proxy gates on truthiness (`if (version) …`) rather than presence
  (`api/replicate.js` L62).
- **String-coerce URLs into array inputs:** TRELLIS sends `images: [String(imageUrl)]`
  (monolith L2481) — guards against a non-string/null leaking into the array.
- **Output normalization** (`normalizeModelUrl`, monolith L2468-2475) defends the *read*
  side: TRELLIS output can be `{ model_file }`, an array, a bare string, or `{ url }`.
  Return `null` only after exhausting all shapes, and the caller throws
  `"No GLB URL returned from TRELLIS"` on null (L2909).

**Crucible reimplementation:** centralize a `buildReplicateBody()` that strips
null/undefined and coerces URL fields, plus a typed output-normalizer per model. Never
hand-spread inputs at call sites.

---

## 3. Rate-limiting — what exists, and the gap to close

The reference has **two distinct, partial** mechanisms — neither covers Replicate 429
with a real retry:

1. **Anthropic overload retry** (`callWithRetry`, monolith L2345-2359): retries only on
   `"529"` / `"Overloaded"`, fixed 2s wait, 3 attempts. **Replicate is not wrapped by
   this.**
2. **Batch staggering** (`runBatchSequential`, monolith L2679-2680): a flat
   `setTimeout(2500ms)` *between* sequential jobs "to avoid Replicate 429." This is
   spacing, not backoff — a burst or a slow upstream still 429s with no recovery.

**Crucible reimplementation (close the gap):** a single `withRetry` wrapping *all*
provider calls with **exponential backoff + jitter**, honoring `Retry-After`, and
treating 429/503/529 as retryable; keep job staggering as a coarse pacing layer on top.
The batch worker (Phase 3) needs this to be resumable and cost-capped, not just spaced.

---

## 4. TRELLIS image-to-3D wiring (exact params that worked)

`startTrellisPrediction` (monolith L2479-2496) → versioned endpoint. Input:

```
images:                 [String(imageUrl)]   // single source image, string-coerced
texture_size:           1024
mesh_simplify:          0.95
generate_color:         true
generate_model:         true
generate_normal:        false
randomize_seed:         false
seed:                   0
ss_sampling_steps:      12
slat_sampling_steps:    12
ss_guidance_strength:   7.5
slat_guidance_strength: 1.5    // ← lowered from 3 deliberately: reduces TRELLIS
                               //   recoloring, keeps output near the source palette
```

- **The `slat_guidance_strength: 1.5` tuning is a real lesson** — at 3 TRELLIS
  reinterpreted colors away from the source image; 1.5 keeps it on-palette. Preserve
  this default; it directly serves Crucible's "on-canon" requirement.
- **Pre-TRELLIS image prep:** the 2D→3D flow runs a **smart cutout + bg removal** to a
  transparent PNG on a neutral field before sending to TRELLIS (`smartCutoutAndUpload`,
  monolith ~L6876-6886; `removeBackground` via `lucataco/remove-bg`, L2507). Falls back
  to the full image if cutout fails. Clean isolated subject → better mesh. This maps
  directly to Crucible's `"<prop>, …, isolated object, neutral background"` prompt rule.
- **Cost noted in UI:** ~$0.08/model, ~60–90s each (monolith L6719, L6912).
- **Output:** `{ model_file }` is the GLB; an optional preview image may ride in
  `output[1]` when the output is an array (L6906).

---

## 5. Async prediction polling (CORS-safe, proxied)

The browser **cannot** poll Replicate's prediction URL directly (CORS), and **cannot**
hold provider keys. Everything routes through Vercel serverless `/api/*`.

`pollReplicatePrediction` (monolith L2383-2408):
- Extracts the prediction id from `pred.urls.get` (or builds
  `…/v1/predictions/{id}`), then polls `/api/replicate-poll` server-side.
- **Escalating delays** `[2000, 2500, 3000]ms`, clamped at the last value.
- Honors an `AbortSignal` (throws `"CANCELLED"`), reports status via `onStatus`.
- `succeeded` → `Array.isArray(output) ? output[0] : output` (so object outputs like
  TRELLIS pass through whole for `normalizeModelUrl`).
- `failed`/`canceled` → throw; **timeout after 120 attempts** with the message "Timed
  out after 3 minutes" — ⚠️ the arithmetic is off (120 × ~3s ≈ 6 min). Fix the message
  *and* make the timeout per-model (TRELLIS legitimately needs minutes; flux-schnell is
  seconds).

**Crucible reimplementation:** a provider-agnostic poller in the executor-adapter with
**per-model timeouts**, abort support, and structured status events the batch worker and
UI both consume. Cancel via `/api/replicate-cancel` is fire-and-forget (L2410-2418).

---

## 6. Persisting outputs (temp provider URLs expire — capture immediately)

Replicate/ElevenLabs output URLs are **temporary**. `api/supabase-upload.js` server-side
fetches the temp URL and re-uploads to Supabase Storage, returning a permanent public
URL:
- `x-upsert: true` on upload → **safe to retry** (overwrite-on-conflict).
- Extension derived from `mimeType`; folder derived from a `FOLDER_MAP`.
- Returns `…/storage/v1/object/public/{bucket}/{path}`.

**Lesson:** persist the asset to durable storage the moment a job succeeds, before the
temp URL rots; store the permanent URL on the asset row. For Crucible this is the
`raw_path` write, and (Phase 3) the CDN publish step writes `cdn_url`. Keep upserts so
retries/resumes are idempotent.

---

## 7. Anthropic prompt enrichment + caching (90% cost lever)

- Claude (`claude-sonnet-4-20250514` in the reference) turns a terse spec into an
  optimized FLUX prompt, with the **art-bible constraints in the system prompt**
  (`enrichPrompt`, `enrichUIPrompt`, etc.).
- **Prompt caching:** system blocks carry `cache_control: { type: "ephemeral" }` and the
  call sends beta header `prompt-caching-2024-07-31` (monolith L2425, L2536) — cited as
  ~90% cost savings on repeated system prompts.
- **Style anchoring:** `goldenHint` injects a `STYLE ANCHOR (match closely)` block — the
  proven pre-LoRA consistency mechanism (§0).

**Crucible reimplementation:** the canon's `prompt_prefix`/`prompt_suffix`/
`negative_prompt` (CANON_INTAKE §4) replace the hardcoded per-game system prompts; keep
ephemeral caching; use the canon's reference images as the style anchor. Update the model
id to a current Claude model at build time — `claude-sonnet-4-20250514` is the
reference's pin, not necessarily today's best.

---

## 8. Other proven techniques worth carrying forward

- **Deterministic HQ via upscale, not re-diffusion:** generate at 512 then
  `nightmareai/real-esrgan` `scale:2` → 1024 with **zero generative drift** (preserves
  pose/composition exactly; monolith L2455-2463). Good "uplevel" that doesn't fight the
  canon — relevant to Kiln's "finish without restyling" goal.
- **img2img for cross-frame/variant identity:** FLUX Redux `redux_image` and FLUX Depth
  `control_image @ strength 0.45` lock a subject across an animation strip or variant set.
- **Cost estimation up front:** `COST_MAP` per resolution, `CLAUDE_COST`, per-model costs
  → batch `cost_estimate` vs `cost_actual` (matches Crucible's `batches` schema).
- **Recipe snapshotting instinct:** the forge already thought in terms of freezing
  model+prompt+params; Crucible formalizes this as `recipe_snapshot` (incl. canon + LoRA
  version) for full reproducibility and LoRA A/B.

---

## 9. Anti-patterns in the reference — do NOT carry these over

- **Hardcoded secrets in source.** `api/supabase-upload.js` (L14-15) and
  `src/lib/supabase.js` (L4-5) embed the Supabase URL **and anon key** as string
  literals; provider API keys are passed **from the client in request bodies**
  (`{ apiKey, … }`). Crucible: server-side env vars only, keys never leave the server,
  Supabase config from env. (The reference's `.env.local` only held a Vercel OIDC token.)
- **localStorage as source of truth.** Profiles, maps, and asset indices persist to
  `localStorage` (`sset`, `MAPS_INDEX_KEY`, etc.). Crucible: Supabase is authoritative,
  project-scoped, from line one.
- **11.9k-line single-file React monolith.** `LivingDungeonGenerator.jsx` mixes API
  layer, prompt logic, batch runner, tilemap editor, and UI. Crucible: clean module
  seams (intake · canon · generation · Kiln · review · publish), kits reused not inlined.
- **Hardcoded absolute API base.** `callAnthropic` fetches
  `https://living-dungeon-asset-forge.vercel.app/api/anthropic` (L2363) — a different
  deployment's URL. Use relative `/api/*` (as the Replicate calls already do) or an env
  base.
- **Stale/contradictory version pins & timeout messages** (§1, §5) — pin deliberately,
  comment truthfully, snapshot into recipes.

---

## 10. Reimplementation checklist (carry into Phase 1)

- [ ] Executor-adapter (kit): data-driven model registry, version-vs-endpoint routing,
      `Prefer: wait` for fast models, `buildReplicateBody()` that strips null/undefined.
- [ ] Provider-agnostic poller: per-model timeouts, abort, structured status.
- [ ] `withRetry`: exponential backoff + jitter + `Retry-After`, covering Replicate 429
      (the real gap) and Anthropic 529.
- [ ] TRELLIS preset (§4) incl. `slat_guidance_strength: 1.5` and the cutout→bg-removal
      pre-step; re-verify the pinned version hash.
- [ ] Immediate durable persistence of outputs (upsert), permanent URLs on the asset row.
- [ ] Claude enrichment with ephemeral prompt caching, canon-driven scaffolding + style
      anchor (current Claude model id).
- [ ] Server-side secrets; Supabase authoritative + project-scoped; relative `/api`.
- [ ] LoRA pipeline built **fresh** per CANON_INTAKE §5 (no mined code exists) — the
      §0 prompt+anchor+img2img stack is the bootstrap/pre-LoRA path.
- [ ] Everything frozen into `recipe_snapshot` for reproducibility.

---

*End of Phase 0 kernel mining. Per the kickoff: stopping here for Director review before
Phase 1.*
