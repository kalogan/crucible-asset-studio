# Wayfinders — Art Bible

*The single source of truth for the game's look. Written to keep diverse content
cohesive — the thing that stops 30 biomes, 8 classes, and a bestiary from looking
like ten different games — and, specifically, to **train and steer an asset-generation
LoRA** so every generated model lands on-style.*

> **Companions:** the terse engineering spec is `docs/ART_SPEC.md` (budgets, rig,
> export); the environment-build process is `docs/ENVIRONMENT-ART-PIPELINE.md`. This
> bible is the *aesthetic* layer above both — the vocabulary, palettes, shape language,
> and per-category direction. When they conflict on a technical number, `ART_SPEC.md` wins.

---

## 0. How to use this for a LoRA

This doc does double duty. **§1–§13 are the style** (read them; they're the look). **§14
(Do/Don't)** and **§15 (LoRA playbook)** are the operational layer for training:

- **§15 gives you a trigger token, a caption template, a tag vocabulary, a dataset
  recipe, and a negative-prompt list.** Use the *same descriptive words* in captions
  that this bible uses in prose — that consistency is what the LoRA latches onto.
- Train on **rendered turntables of the real in-game assets** (neutral lighting, plain
  background, 3–4 angles each) so the LoRA learns **form + material**, not scene lighting.
  Add a smaller set of **in-situ beauty shots** (tagged separately) for mood.
- The LoRA learns the *rendered look*; the **final 3D asset must still obey §3** (poly
  budget, faceting, materials, export). The two together = an on-model, in-engine asset.

---

## 1. North star (the one paragraph)

**Wayfinders is cozy-stylized faceted low-poly with soft bloom.** Inviting, warm,
rounded, hand-made — *never* grim, gritty, or photoreal. Forms are chunky and
silhouette-first: you recognize everything by its outline before any detail. Surfaces
are **flat-shaded facets** with almost no small surface noise; color comes from
**vertex colors and flat/emissive materials**, not busy textures. Warmth concentrates
at safe, human points — braziers, lanterns, camps, hearths — glowing against a soft,
saturated-but-gentle world. The feeling is a **storybook diorama you could pick up**:
legible, tender, and a little luminous.

> If a generation looks like it belongs in a survival-horror game, a realistic AAA RPG,
> or a mobile gacha with hyper-detailed gloss — it's wrong. It should look like a warm
> papercraft toy lit by a campfire.

---

## 2. Style DNA — the eight repeatable descriptors

Every asset, every caption, should carry this DNA. These are the words to repeat:

1. **Faceted low-poly** — flat-shaded planes; visible, deliberate facets; no smoothing
   groups that hide the polygon language.
2. **Chunky & rounded** — soft, full forms; rounded corners and bevels; nothing thin,
   spindly, or needle-sharp unless the silhouette *demands* it (an ice spike, a spire).
3. **Silhouette-first** — readable as a black shape at thumbnail size; identity lives in
   the outline, not surface detail.
4. **Vertex-color / flat material** — broad flat color fields and gentle gradients;
   minimal-to-no texture detail; **no PBR grime, no normal-mapped pores**.
5. **Emissive warmth** — glow is *emissive + bloom* (fire, lanterns, runes, auroras,
   crystals), concentrated and intentional, against cooler surroundings.
6. **Cozy-warm key light** — a single soft, slightly-amber sun/moon; gentle ambient; soft
   contact shadows. Calm, even, inviting light — not dramatic chiaroscuro.
7. **Anchored & legible** — scenes read clearly; a hero landmark gives orientation; you
   can always *see* the thing (contrast over murk, even at night).
8. **Hand-made charm** — slight asymmetry, a little wobble, warmth over precision; a
   storybook/papercraft/diorama feel, never sterile or machined.

---

## 3. Technical 3D spec (the asset must obey these)

From `ART_SPEC.md` — the constraints that make a generated model usable in-engine:

| Aspect | Spec |
|---|---|
| **Topology** | Flat-shaded facets; clean, low triangle counts; no smoothing that hides the poly look. |
| **Poly budget** | Prop ~100–800 tris · character (humanoid/creature) ~1–3k · hero piece ≤ 5k. |
| **Materials** | Flat / gradient / **emissive**; **vertex colors over textures** (atlas only if textured). No PBR maps, no normal/roughness/metallic detail. |
| **Glow** | `emissiveIntensity > 1` + `toneMapped:false` + Bloom — never real per-object lights. |
| **Scale / axes** | 1 unit = 1 meter · **+Y up · +Z forward**. |
| **Pivots** | Props pivot at base/ground contact; characters at feet center. |
| **Export** | glTF (`.glb`), Y-up, +Z-forward, baked transforms, **no embedded lights/cameras**. |
| **Instancing** | Repeated fields (rocks/trees/grass) share one geometry+material (instanced). |
| **Naming** | kebab-case ids matching the pack art-kit refs: `prop.ice-spike`, `mob.rime-elemental`, `char.pathfinder`. |

**Shared humanoid rig:** all humanoids (players + humanoid mobs) skin to **one standard
skeleton with Mixamo-compatible bone names + standard proportions**, so library animation
clips retarget cleanly. Generate the *mesh*; the shared clip set (idle/run/attack/cast/
roll/death) drives it. A generated humanoid that can't bind to this rig is unusable — keep
proportions standard (see §7).

---

## 4. Render & lighting

The look is as much *lighting* as geometry. For training-render consistency and in-engine truth:

- **Flat / facet shading** — hard normals, visible polygons. No subsurface, no glossy
  speculars beyond a soft sheen.
- **Soft bloom** is the signature post effect: emissive elements bleed a gentle halo.
  Tone-mapping is **ACES filmic + sRGB** (warm, filmic rolloff — not raw/clipped).
- **One key light**, soft and slightly amber (sun by day, moon by night), + flat ambient
  + a few fixed emissive fixtures. **No per-object lights.** Soft, short contact shadows.
- **Night ≠ dark-mush.** Night biomes read through **emissive contrast** (auroras, glowing
  ice, lanterns, rune-glow), never murk. Legibility is non-negotiable (§14).
- **Training renders:** neutral 3/4 + front + side + back on a **plain mid-grey or soft
  gradient background**, even lighting, no scene props — so the LoRA learns the asset's
  *form*, not a biome's lighting. Keep beauty/in-situ shots a separate, smaller, clearly-
  tagged slice.

---

## 5. Color system

**Philosophy:** saturated-but-soft; broad flat color fields; warmth pooled at safe points
against cooler surroundings; **never encode meaning by color alone**, never let colors
blend into mush (the #1 past complaint). Each region owns a **distinct palette + sky + fog
+ prop materials** so biomes never blur together.

**Master tendencies:** cool pastels for snow/water (`#e8f0ff`, `#cdddf2`); warm amber-orange
**emissive** for fire/lanterns (`#ffb24d` → `#ff8c42`); teal/violet/green soft-saturated for
auroras and magic glow.

### The 7 themed regions (the real in-engine palettes)

Each region is a **band** (1 = beginner → 7 = endgame). Use the region name + these hexes
as caption tags so the LoRA can be steered per-region.

| Band · Region | Mood | Primary / Secondary / **Accent** | Sky (zenith→horizon) · warmth | Signature materials |
|---|---|---|---|---|
| **1 · Glacial Aurora** | Cool night-glow; crystal, snow, shifting auroras; deep-blue dark carried by emissive | `#243258` / `#5a72b0` / **`#5cffd0`** | `#0e1430`→`#243a6a` · 0.2 | glow-ice, frost-timber, rune-stone |
| **2 · Verdant Wilds** | Lush wild green; mist, light-shafts, canopy-filtered light; jungle/bog/forest | `#2f5a32` / `#4f8a3e` / **`#a8e063`** | `#cfe6d4`→`#9fc79a` · 0.5 | living-wood, moss-stone, vine-lattice |
| **3 · Golden Reach** | Warm golden-hour start band; cultivated, lived-in amber lowlands (the FTUE home) | `#c98a3a` / `#e8b24a` / **`#ffd98a`** | `#5a78a8`→`#e8a85a` · 0.78 | sun-timber, amber-stone, woven-thatch |
| **4 · Sunlit Shores** | Bright aqua water's edge; pale sand, turquoise shallows, gentle surf, oasis | `#2fb7c4` / `#7fe0d8` / **`#fff2c4`** | `#6fc2e8`→`#cdeef2` · 0.55 | driftwood, coral-stone, woven-reed |
| **5 · Emberlands** | Warm fire-glow at dusk; basalt + ash lit by braziers, paper lanterns, slow coals; festival | `#5a2422` / `#c0432a` / **`#ff8a3a`** | `#2a1424`→`#a8442a` · 0.92 | basalt, lantern-paper, ember-iron |
| **6 · Ancient Depths** | Deep-time stone (endgame); ancient masonry, amber-locked relics, hushed weight of ages | `#3e3633` / `#837a72` / **`#d9a23a`** | `#3a3442`→`#6a5e58` · 0.4 | ancient-masonry, fossil-amber, weathered-bronze |
| **7 · Blossom Spring** | Soft pastel spring; drifting pink-white blossom over fresh green; still water, quiet shrines | `#f3c2d6` / `#7fbf7a` / **`#fff0f5`** | `#a9c8e8`→`#fbe0ec` · 0.62 | blossom-timber, paper-shoji, mossy-stone |

> **Read the accent column as "where the glow lives."** Glacial = teal aurora; Emberlands =
> ember-orange; Blossom = near-white petal-light. The accent is the emissive note that makes
> each region sing against its primary/secondary base.

---

## 6. Silhouette & shape language

- **Read the outline first.** Every asset must be identifiable as a flat black shape. If two
  things share a silhouette, they're not differentiated enough (the old creature-family bug:
  every quadruped a boxy 4-legger, every flyer the same V-wing — *don't*).
- **Chunky, full, rounded volumes** with soft bevels. Big simple primary forms, one or two
  bold secondary shapes, minimal tertiary detail. **Generous, confident proportions** over
  fiddly realism.
- **Anchors & hero shapes.** Environments are built around a **hero landmark** — a lighthouse,
  world-tree, torii gate, henge, sunken shrine, great forge — that gives a sense of place and
  orientation (Kevin loves these). Hero assets earn extra polys + a stronger silhouette.
- **Faceting as a feature.** Let the planes show. A crystal is a few big facets; a tree canopy
  is faceted clusters, not a noisy sphere; rock is angular slabs, not displaced detail.

---

## 7. Characters — the 8 classes

**Rig & proportions (mandatory):** one shared humanoid skeleton, **standard, slightly-stylized
proportions** (roughly heroic-but-cozy: ~7-head height, soft hands/feet, rounded forms),
Mixamo-compatible. Faces are simple + warm (small features, friendly), hair/clothing are
faceted shells. **Identity is silhouette + gear + palette**, instantly recognizable across a field.

The eight playable classes — each must read distinctly at a glance:

| Class | Archetype | Silhouette / read |
|---|---|---|
| **Pathfinder** | Ranged scout/ranger | **Hooded** ranger; cloak + bow; lean traveler's gear; earthy greens/browns. |
| **Scamp** | Trickster archer/rogue | **Lithe, light** rogue; smaller frame; daggers/short bow, caltrops/smoke; shadowy accents. |
| **Warden** | Hearth-keeper guardian | **Armored, broad** tank; heavy pauldrons + shield + banner; solid, grounded; earth/iron tones. |
| **Kindler** | Ember hearth-sage (AoE controller) | **Robed** sage; hearth-fire motifs; staff/brazier; warm ember-orange glow. |
| **Bloomtender** | Nature healer (HoT zones) | **Gentle, soft** healer; floral/leaf motifs; tender greens + petal accents; nurturing read. |
| **Stargazer** | Celestial ranged controller | **Ethereal, flowing** caster; star/sky motifs; long robes; cool teal/violet celestial glow. |
| **Tinker** | Gadget/engineer | Practical maker; tools, contraptions, satchels; warm coppers/brass; busy-but-tidy gear. |
| **Wayfarer** | Traveling-bard support | Wanderer-minstrel; instrument, travel-pack, layered traveler's clothes; warm, road-worn. |

Per-class **spell-FX read** is part of their identity (Stargazer celestial, Bloomtender floral,
Kindler fire, Pathfinder ranged, Scamp shadow, Warden earth) — see §FX in the quality bar.

---

## 8. Creatures — body-type families

The bestiary runs on a **creature engine** with body-type families. **Each beast must look like
the animal it is** — not a palette-swap of one shared silhouette (the explicit past failure). A
per-species **feature kit** differentiates within a family:

- **Biped** — humanoid-ish stance (kobold/sprite/folk enemies); reuse the humanoid rig where it fits.
- **Quadruped** — distinct silhouettes per species: deer antlers + slim legs, fox brush-tails, boar
  humps + tusks, tortoise shells, big-cat crouch. **Vary leg length, body mass, head shape, and the
  signature feature.**
- **Elemental** — abstract floating/loose-form (rime, ember, stone elementals); emissive core, faceted
  shards orbiting a center; glow carries the read.
- **Flyer** — differentiate wing + body shape by species: moth (broad furry wings), bird (feathered
  fan), bat (membrane), dragonfly (twin narrow pairs). Never one shared V-wing.

**Per-species attack/animation read** matters: a frog hops, a big cat pounces, a sauropod world-boss
lumbers (3× scale). Movement is part of the silhouette. Minibosses + world-bosses get a bigger
silhouette + an accent glow (e.g. the violet dreadnought; Cragback the 3× sauropod).

**Cozy, not scary.** Even hostile fauna read as *characterful* low-poly creatures, not horror — soft
edges, expressive simple faces, charm over menace.

---

## 9. Environment & props

**Biomes are cohesive, OPEN, explorable AREAS** that feel "part of a larger world" — never confined
gimmick levels.
- **OPEN heightfield form** (gentle hills, breathable space), NOT tunnels/corridors or floating-
  platform jump-puzzles (those read as "combat level"/"platformer" and clash with cozy-explore).
- **A hero ANCHOR landmark** per biome (lighthouse, world-tree, torii, henge, sunken shrine, great
  forge) for sense-of-place + orientation.
- **LEGIBILITY first** — you must clearly *see* things; distinct contrast; even night reads via glow.
- **Walkable + comfortable** terrain — no jagged annoying-to-traverse rock, no deep-water swim-mazes.
- **Distinct identity per biome** via the region palette/sky/props (§5).

**Props are bespoke and scene-blending**, not generic reused boxes. Author specific props that *fit
each scene* (the lighthouse, henge, zen pavilion, mesas, braziers, lanterns are the model). A
"per-biome bespoke pass" is the standing approach. Instanced fields (rocks, trees, grass, crystals)
share one faceted geometry+material and scatter naturally. Foliage is **faceted clusters**, water is
**flat translucent planes with a gentle emissive shimmer**, snow/sand are broad soft fields.

---

## 10. Ships / skyboats

The skyboat is a hero cosmetic — a cozy faceted **flying boat** (sails/balloon/engine motifs, warm
wood + painted accents). Five hull silhouettes, each instantly distinct + matching a stat read:

| Hull | Read |
|---|---|
| **Gondola** | Neutral cozy baseline — a balanced, friendly little boat. |
| **Skiff** | Scout — sleek, small, fast-looking; minimal, nimble silhouette. |
| **Glider** | Cruiser — wide, elegant wings/sails; the best-handling, graceful read. |
| **Steamboat** | Tank — chunky, heavy, boilered; tough and slow-looking. |
| **Galleon** | Hauler — big, broad cargo hold; the biggest, most laden silhouette. |

Ships take **ship-skin cosmetics** (accent recolors per hull) — keep the base hull silhouette
recognizable; skins recolor, never restructure.

---

## 11. Gear & cosmetics

- **Appearance ≠ stats** (a hard P2W firewall): the rendered look reads from a cosmetic *appearance
  slot* separable from the stat item — this enables **transmog (mesh-swap)**. Gear pieces are
  **gearKits**: faceted slot meshes (helm/chest/legs/etc.) that swap onto the humanoid rig.
- **Themed gear sets** (e.g. Knight / Royal / Ranger across the slots) — cohesive silhouettes per set,
  faceted detail (crests, bevels, clasps, filigree) over texture detail. Read the set by silhouette +
  palette.
- **Dyes** recolor materials within a **palette-constrained** range (no neon clown chaos — stay in the
  cozy-warm family). **Gear-skins / ship-skins / ability-VFX skins** are cosmetic-only.
- Generated gear must bind to the standard rig slots + keep the cozy faceted language (no realistic
  plate, no hyper-detailed fantasy ornament).

---

## 12. Structures & settlements

- **Skyhold (the hub)** and the **7 Regional Outposts** are bespoke, walkable, cozy safe-haven towns —
  one per region, each themed (Hearthmere golden-grove, Verdance canopy-town, Saltmere fishing-town,
  Glimmerveil aurora warm-lit camp, Cinderforge ember forge-camp, Petalrest sakura shrine-town,
  Gloamhold catacombs delvers' camp). **Open centers, signature features, spread dwellings** (not
  cramped). Buildings are faceted, warm-lit, tidy — tents, lodges, forges, docks, shrines with glowing
  windows + braziers.
- Settlement buildings grow in **tiers** (founding camp → hamlet → thriving town); the look should
  read its tier (more dwellings, lit windows, banners, life).

---

## 13. UI / icons / brand

- **Brand mark:** a **faceted low-poly globe** (derived from the title world-globe) — the same faceted
  language in 2D. Use it as the north-star for icon style.
- **Ability icons:** procedural-feeling SVG glyphs, per-class palettes, clean + legible at small size.
- **UI** is cozy + calm: warm rounded panels, soft contrast, legible type, **WCAG AA + mobile-first**
  (see `ARCHITECT_BUILDER_PIPELINE.md` §5c) — every surface meets AA contrast + works on a phone.

---

## 14. Do / Don't (the negative anchors — critical for LoRA steering)

**DO**
- Faceted low-poly, flat-shaded, chunky rounded forms, silhouette-first.
- Flat / vertex / emissive color; soft bloom; one warm key light; soft contact shadows.
- Saturated-but-soft palettes; warmth pooled at lanterns/braziers/hearths.
- Distinct silhouette per class / creature / biome; a hero anchor per scene.
- Cozy, warm, hand-made, storybook/papercraft/diorama charm. Legible even at night.

**DON'T**
- ❌ Photoreal / realistic / PBR / normal-mapped / high-detail / micro-surface noise.
- ❌ Grimdark, gritty, horror, desaturated mud, muddy "mush" where colors blend.
- ❌ Hyper-detailed AAA fantasy ornament, gacha-gloss, plastic specular.
- ❌ Spindly/needle forms (unless the silhouette demands it), busy tertiary detail.
- ❌ Per-object lights, baked dramatic shadows, harsh chiaroscuro.
- ❌ Tunnels/corridor/jump-puzzle "level" geometry for biomes; cramped scenes.
- ❌ Same silhouette palette-swapped across creatures; generic reused prop boxes.
- ❌ Neon clown dyes; anything that breaks the cozy-warm family.

---

## 15. LoRA playbook (training & prompting)

**Trigger token.** Use one rare, consistent token in every caption + every prompt:
`wyfndrstyle` (pick one and never vary it). Optionally pair with a sub-tag per category
(`wyfndrstyle character`, `wyfndrstyle creature`, `wyfndrstyle prop`, `wyfndrstyle biome`,
`wyfndrstyle ship`, `wyfndrstyle gear`).

**Caption template** (mirror this bible's vocabulary — consistency is the whole game):
```
wyfndrstyle, <category>, <subject>, <region/palette tag>, faceted low-poly, flat-shaded,
chunky rounded forms, vertex-color, soft bloom, emissive <glow note>, cozy warm lighting,
<3/4 | front | side | back> view, plain background
```
*Example:* `wyfndrstyle character, hooded ranger pathfinder, golden-reach palette, faceted
low-poly, flat-shaded, chunky rounded forms, soft bloom, cozy warm lighting, 3/4 view, plain
background`

**Dataset recipe.**
- **Render the real in-game assets** to a turntable: **front / 3/4 / side / back** (≥4 angles),
  **plain mid-grey or soft-gradient background, even neutral lighting** (so the LoRA learns form +
  material, not a scene). ~15–40 images per concept; balance categories so no one type dominates.
- Add a **smaller (~10–15%) "in-situ" slice** — assets in their biome with full bloom/lighting —
  tagged `in-situ` + the region, for mood/context. Keep it minority so it doesn't bias form learning.
- **Cover the spread:** the 8 classes, the creature families + a few exemplars each, hero anchors +
  bespoke props per region, the 5 hulls, a few gear sets, and one or two structures per region — so
  the LoRA generalizes the *language*, not one asset.
- Consistent resolution + framing; subject centered; consistent scale cues.

**Negative prompt (the §14 Don'ts, condensed):**
```
photorealistic, realistic, PBR, normal map, high detail, micro detail, noisy texture,
grimdark, gritty, horror, desaturated, muddy, plastic, glossy specular, gacha, hyper-detailed
ornament, spindly, busy background, harsh shadows, dramatic lighting
```

**Steering knobs at prompt time:** the **region palette tag** (§5) sets the color/mood; the
**category sub-tag** sets the form family; `hero` / `miniboss` raises silhouette weight + glow;
`emissive <X>` places the warmth. Keep `wyfndrstyle` + 3–4 DNA words (§2) in *every* prompt.

---

## Appendix — quick reference card

- **Look:** cozy faceted low-poly + soft bloom; warm, rounded, storybook, legible.
- **Make:** flat-shaded facets, vertex color, emissive glow; props 100–800 tris, chars 1–3k, hero ≤5k.
- **Light:** one warm key + ambient + emissive fixtures; ACES + bloom; no per-object lights.
- **Rig:** one standard Mixamo-compatible humanoid skeleton; generate mesh, retarget clips.
- **Color:** 7 region palettes (§5); warmth at safe points; never mush, never color-only meaning.
- **Identity:** silhouette-first; a hero anchor per scene; distinct shape per class/creature/biome.
- **Export:** glTF, Y-up +Z-forward, baked, no lights; kebab-case art-kit ids.
- **LoRA:** trigger `wyfndrstyle`; neutral turntable renders; mirror this bible's words in captions;
  negative-prompt the §14 Don'ts.
