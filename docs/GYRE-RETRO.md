# GYRE × game-kit — retro & opportunity audit

_2026-07-01. First real game built ON Crucible's game-kit. Audit of how it went + where the
opportunity is, to steer the next games._

## Verdict

The experiment worked at the level that matters: in one session, GYRE went from a blank idea to a
novel, atmospheric, **voiced and negotiable** 3D game — scaffolded from the kit, populated with
imported forge models, using another game's SFX. That validates the north star: the hub+framework
can birth a real game.

**But the sharp diagnosis: the kit gave us _atoms_, not a _game_. We hand-wrote almost everything.**

## The numbers (the tell)

- GYRE = **2,367 hand-written lines** across 8 files (`main.tsx` 621, `hollow-dialogue.tsx` 636,
  `effigy.tsx` 354, `room*.tsx` ~570, `player.tsx` 183).
- It imports **~11 symbols** from ~8 of the 27 vendored kit modules: `createRng`, `createPalette`,
  `nonIndexedFlat`/`jitterVerts`, `damp`, `createAudioManager`, `createInputMap`, `createSceneMachine`,
  `useFirstPersonCamera`, `PostFx`, `Particles`, + the npc brain.

So: **~11 primitives → ~2,300 lines of glue.** The kit supplied ingredients (faceting, bloom,
particles, RNG, a scene machine, an FP-camera _math_ core, and the standout npc brain). The _game_ —
controls, model loading, rooms, dialogue UI, lighting, the descent, the entities — was all bespoke.

## What genuinely worked

- **The npc brain is the crown jewel** — client-side, free, with real memory. The talking Hollow is
  the most compelling thing here, and it came from the kit.
- **The asset loop closed**: forge model → Crucible library → into GYRE by URL (Hollow, Warden,
  watcher); Storm-Break SFX → library → GYRE's footstep. The studio worked as designed.
- **Scaffold-to-running was fast** (one command, all modules vendored); **parallel agents** built
  features concurrently without collisions.

## Where the kit fell short — the "last mile"

Each is a thing we'll rebuild for _every_ game unless the kit absorbs it. All surfaced this session:

| Gap | Cost |
|---|---|
| FP camera is input-agnostic | `player.tsx` (183 lines): pointer-lock + WASD + collision + eye-height around the math-only camera |
| `LightingRig` defaults to warm daylight | hand-rolled a cold rig — the kit was actively _wrong_ for a moody game (later fixed via the Storm-Break moody preset) |
| No model-loader | auto-fit + material handling hand-built in `effigy.tsx` per figure |
| DOM-in-Canvas crashes | **two** debug rounds — raw `<div>`/`createPortal` crash R3F; only drei `<Html>` works, and nothing warns you |
| `scene-state` has no react bridge | hand-wired setState into the state table |
| `AudioManager` won't play samples / hides its context | stood up a _second_ AudioContext to play one WAV footstep |
| npc: mock is content-blind, wants a BudgetedProvider, drags `zod` to the client | branching layered _outside_ the brain (a "split brain"); +557KB bundle |
| Scaffolder emits **duplicate imports** | the generated project **doesn't compile** out of the box |

## The structural risk (the real threat)

**game-kit now exists in three drifting copies:** canonical `web-projects/game-kit`, Crucible's
**vendored** copy (where all this session's improvements — B5, embedder, moody lighting, the audio kit
— actually landed), and GYRE's **own** vendored copy (older). So **GYRE can't use the moody preset or
the audio kit we just built** without a re-vendor. Left unfixed, the framework **cannot compound** —
every game freezes a different kit version and improvements never propagate. This is the biggest thing
between "we made one game" and "the kit makes games."

## Opportunities, ranked

1. **Harvest GYRE's glue back into the kit.** The kit was mined from games originally; GYRE is fresh
   ore. Turn its ~2,300 hand-written lines into reusable r3f helpers: `usePointerLockFPController`, a
   `<GltfModel autoFit recolor?>` loader, an `<Overlay>` (drei-Html) wrapper, `useSceneMachine`, and
   sampled-audio on `AudioManager`. **Highest leverage** — closes the last-mile gap so game #2 starts
   where GYRE ended.
2. **Fix the vendoring drift.** One source of truth + a re-vendor command. Without it, #1 doesn't propagate.
3. **Fix the scaffolder** (dup imports) — table stakes; every scaffold is currently broken. (chip spawned)
4. **Make the scaffold a real, opinionated, _compiling_ starter** — a "moody atmospheric explorer"
   template _is_ GYRE-shaped; ship it so the next such game is 80% done at scaffold time.
5. **npc ergonomics** — a client-safe, zod-free, selector-driven mock; document the client/server
   split + the BudgetedProvider requirement.
6. **Adopt the shipped audio kit in GYRE** + make game→studio audio bake/import first-class.

## The one move

**Harvest GYRE → game-kit, then fix the vendoring so it propagates.** That converts a one-off game
into a reusable framework — "scaffold a game and it's already playable." The proof the vision works is
done; the opportunity is to make the _second_ game 5× cheaper than the first.
