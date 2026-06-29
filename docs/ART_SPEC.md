# Wayfinders — Art Spec (lightweight)

The minimum spec that keeps **diverse content cohesive** — the thing that stops
10 biomes from looking like 10 games. Every asset (procedural, commissioned, or
pack-sourced) must conform. Pairs with `blueprints/00_PROJECT_BRIEF.md` and the
cozy-warm tokens in `blueprints/07_PHASE_4A_FROSTPEAKS_ZONE_RENDER.md`.

## 1. Aesthetic
- **Genre target:** cozy-stylized **faceted low-poly + bloom**. Inviting, warm,
  rounded — *not* grim/realistic. (Match the genre look; never clone a specific
  game's copyrighted assets 1:1.)
- **Form language:** chunky, rounded silhouettes; flat-shaded facets; minimal
  small surface detail; read silhouette-first.

## 2. Palette (cozy-warm)
- **Key light:** warm (slightly amber) directional sun/moon.
- **Snow / cool base:** pastel cool whites & pale blues (e.g. `#e8f0ff`, `#cdddf2`).
- **Warm accents / fire:** brazier amber-orange **emissive** (`#ffb24d` → `#ff8c42`).
- **Aurora skybox:** teal/violet/green gradients, soft and saturated.
- Saturated-but-soft. Warmth concentrated at safe points (braziers, camps).

## 3. Materials & lighting (ties to RENDERING_STABILITY)
- Flat / gradient / **emissive** materials; **vertex colors over textures** where
  possible (atlas if textured).
- Glow = `emissiveIntensity > 1` + `toneMapped: false` + Bloom — **not** real lights.
- **Constant scene light count** (one shadow-casting key + ambient + fixed
  fixtures). **No per-object / per-character lights.**
- **Shared materials** across repeated objects/actors (shared shader programs).

## 4. Budgets (targets, not hard caps)
- Prop: ~100–800 tris. Character (humanoid/creature): ~1–3k. Hero piece: ≤5k.
- Instanced fields (rocks/trees) must share one geometry+material (`InstancedMesh`,
  `frustumCulled={false}`).

## 5. Conventions
- **Scale:** 1 unit = 1 meter. **Up:** +Y. **Forward:** +Z.
- **Pivots:** props pivot at their base/ground contact; characters at feet center.
- **Naming:** kebab-case ids that match the pack **art-kit refs** (e.g.
  `prop.ice-spike`, `mob.rime-elemental`, `char.pathfinder`).
- **Export:** glTF (.glb), Y-up, +Z forward, baked transforms, no embedded lights.

## 6. The shared humanoid rig (enables procgen humanoids + library anims)
- **One standard humanoid skeleton** for ALL humanoids (player + humanoid mobs),
  with **Mixamo-compatible bone names** and **standard proportions** so library
  animation clips retarget cleanly.
- Procedural humanoid meshes are **skinned to this rig** — we never procedurally
  animate humanoids; we generate meshes that rigged clips can drive.
- One shared `AnimationMixer` clip set per humanoid type (idle/run/attack/cast/
  roll/death) — instancing/perf-friendly.

## 7. Procedural art rules (Procedural Art Kit)
- Generators are **seeded & deterministic** (`(art-kit id, seed, params) → mesh`),
  same discipline as `sim-core`. Output must conform to §2–§6.
- **Bake to glTF** at author time (roll seeds → preview → save what you like →
  commit). Runtime loads the baked asset by art-kit id.
- **Source-agnostic seam:** a pack references an art-kit **id**; the renderer maps
  id → baked glTF. Procedural is the preferred source; a bought asset pack is a
  drop-in **fallback** for any id that procgen underdelivers.

## 8. Cosmetic seams (from the F2P/cosmetic model — leave hooks, build later)
- **Appearance ≠ stats:** rendered look reads from an *appearance slot* separable
  from the equipped stat-item (enables transmog).
- **Dyes:** materials expose recolor params (palette-constrained).
- **Cartography/camp cosmetics:** Map Table + brazier/camp renders read a "style"
  param (an account cosmetic).
- Cosmetics are account-scoped **entitlements**, in their own data — they **never**
  touch the gear/loot/stat path (P2W firewall).
