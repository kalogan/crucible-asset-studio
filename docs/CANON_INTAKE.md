# CANON INTAKE — Crucible companion

**Version:** v1
**Companion to:** `HANDOFF_crucible.md` (slots into §3 "Game-context intake" + "Canon engine", and Phase 2 of the build order)
**Purpose:** the per-game process that defines a game's **art bible** and derives a **precise, trainable LoRA** before any assets are generated.

---

## 0. Why this is the quality gate

The precision of the LoRA is **downstream of the precision of this intake.** A vague art bible trains a mushy LoRA, which produces the exact prototypy drift Crucible exists to kill. So this process is not a form to fill — it's an **adaptive interrogation** that refuses to proceed until the canon is concrete. Garbage-in here is the single biggest risk to output quality.

---

## 1. The flow: auto-draft → grill → refine → derive

Not a static questionnaire. A loop:

1. **Auto-draft.** Intake reads the game's docs/repo/README/design notes (`projects.context_ref`) and drafts a first-pass canon across every category in §2 — filling what it can infer, marking what it can't.
2. **Grill.** It identifies the **thin, generic, or ambiguous** categories and asks *targeted* follow-ups — only where understanding is insufficient, not a rote walk through every field. Behave like an art director interrogating a weak brief: push on vague answers ("'stylized' how — toward what?"), demand specifics (hex, references, do/never rules), surface contradictions.
3. **Refine.** User answers → canon updates → re-evaluate against the precision bar.
4. **Derive.** Once the bar is met, emit the three outputs (§4): the human-readable art bible, the machine-usable prompt scaffolding, and the LoRA training plan.

**Precision bar (don't proceed until all true):**
- Every category in §2 has a *concrete, non-generic* answer (no "fantasy," "cool palette," "stylized" left unqualified).
- Palette has actual hex values and a stated saturation/contrast level.
- Render style is unambiguous (a person could pick it out of a lineup).
- At least 3 explicit **do** rules and 3 **never** rules exist.
- At least one reference image or named reference work is attached.
- Scale/camera context is stated (it determines detail budget and which faces matter).

If a category can't be made concrete, that's flagged in the bible as a known-open question, not silently defaulted.

---

## 2. Art-bible framework + starter question bank

Ten categories. Each lists starter questions; the grill adds follow-ups as needed.

**1. Identity & genre anchor**
- One line: what is this world?
- Genre + era/period? Tone (grim / whimsical / neutral / heroic)?
- "Looks like X meets Y" — name 2–3 reference games/films.

**2. Mood & emotional register**
- What should the player *feel* moment to moment?
- Warm or cold? Safe or threatening? Grounded or fantastical?

**3. Palette**
- Primary / secondary / accent colors (hex).
- Saturation (muted ↔ vivid) and contrast (flat ↔ punchy) levels?
- Any *forbidden* colors? Lighting color temperature (warm/cool)?

**4. Material & surface language**
- Dominant materials (wood, rusted metal, chrome, fabric, stone…)?
- Wear/age: pristine, lived-in, or decayed?
- Surface finish: matte, satin, glossy? Texture density: clean or grungy?

**5. Form & silhouette**
- Proportions: realistic or stylized/exaggerated (and which way)?
- Shape language: rounded/organic vs. angular/geometric?
- Detail density: minimal or ornate? Line/edge weight?

**6. Render style**
- Realistic PBR / stylized PBR / hand-painted / cel / low-poly / painterly?
- Outlines or none? Describe the "shader vibe" in one sentence.

**7. Lighting & atmosphere**
- Key light quality (hard/soft), default direction?
- Shadows: crisp or diffuse? Fog/haze? Default time of day?

**8. Scale & camera context**
- Camera: top-down / isometric / first-person / third-person?
- Typical asset class: props, architecture, characters? Typical scale?
- Which faces/angles actually get seen (drives detail budget)?

**9. Do / Never (the most LoRA-relevant)**
- "Always looks like…" (≥3 concrete rules).
- "Never looks like…" (≥3 concrete rules → seeds `negative_prompt`).

**10. References**
- Canonical example images, existing in-game art, mood board, named works.

---

## 3. The grill: behaviors

- **Reject genericness.** "Stylized," "cool," "fantasy," "high quality" are non-answers — push for the specific.
- **Demand evidence.** Prefer hex over color names, named references over adjectives, images over prose.
- **Surface contradictions.** "You said grounded/realistic but referenced a cartoon — which governs?"
- **Stop when concrete, not when complete.** Don't interrogate categories the docs already nailed; spend questions where understanding is thin.
- **One focused question at a time** when drilling; batch only when the gaps are independent.

---

## 4. Derivation: canon → usable artifacts

Once the bar is met, produce three things (all stored on the `canons` row):

1. **Art bible** (`style_guide` jsonb + human-readable) — the full answers, organized by §2 category. The reference document.
2. **Prompt scaffolding** — derived from the bible:
   - `prompt_prefix` (identity + render style + key material/lighting cues every asset inherits)
   - `prompt_suffix` (quality/scale/camera framing cues)
   - `negative_prompt` (built directly from the "Never" rules + forbidden colors)
3. **LoRA training plan** (§5) — what the training set must exemplify, caption schema, trigger word, and the path (A or B).

---

## 5. LoRA training: two paths

A game's `canons.lora_status` moves `none → training → ready`. The training set comes from one of two paths (Crucible supports both; pick per game):

**Path A — existing reference art (you already have canonical images, OR an engine that can render your assets).**
1. Build the training set so the LoRA learns **form + material, not scene lighting**:
   - **Neutral turntables of the real assets** — render each asset at 3–4 angles (front / 3-4 / side / back) on a plain mid-grey or soft-gradient background, even neutral lighting, no scene props. ~15–40 images per concept; balance categories so none dominates.
   - **A small in-situ slice (~10–15%)** — assets in their real environment with full lighting/bloom, tagged separately, for mood/context only. Keep it a minority so it doesn't bias form learning.
2. Caption each with the schema (§5.1) + the trigger word; keep the bible's exact vocabulary in captions.
3. Train on cloud (Replicate / RunPod / fal — see Crucible §9). Output `.safetensors`, version it.
4. Set `lora_ref`, `lora_trigger`, `lora_status='ready'`.
> For an existing game with real assets (e.g. Wayfinders), this is the path — your "reference art" is your own rendered assets, which requires a **turntable-render pipeline** as a prerequisite build (specs the angles/bg/lighting; produces the dataset).

**Path B — no reference art yet (bootstrap / cold start).**
1. Generate a candidate set using the **prompt scaffolding only** (base model + heavy prompt direction, no LoRA yet). Output is less consistent — expected.
2. **Curate hard**: keep only the on-canon results, discard drift. This is heavier than Path A; iterate prompts until you have 15–30+ keepers that agree.
3. That curated set becomes the training set → caption (§5.1) → train → now the LoRA *enforces* what prompt-coaxing only approximated.
4. Set `lora_ref`/`trigger`/`status='ready'`.
- Bootstrap is how a brand-new game (like the deception game's noir station) gets a LoRA before any art exists: prompt your way to a consistent-enough seed, then crystallize it.

**5.1 Caption schema (precision lives here).**
- Format every caption consistently: `<trigger_word>, <content description>, <style tags from the canon>`.
- The trigger word is unique per canon (e.g. `wyfndr_style`, `noirstn_style`).
- Caption *consistency across the set* is what makes the style lock precise — vary captions wildly and the LoRA learns mush. Keep the style tags identical; vary only the content description.

**5.2 Validation (don't trust a LoRA blind).**
- After training, run a fixed **test battery** — the same handful of prompts every time (e.g. "a barrel," "a doorway," "a lamp" in the canon).
- Eyeball on-canon-ness. If it drifts, refine the training set (tighter curation) or settings and retrain.
- Freeze the LoRA version into every asset's `recipe_snapshot` so output is reproducible and you can A/B LoRA versions.

---

## 6. A canon is "ready" when…

- The precision bar (§1) is met.
- Prompt scaffolding (`prefix`/`suffix`/`negative`) is derived and stored.
- A LoRA is trained, validated against the test battery, versioned, and `lora_status='ready'`.
- A fixed test battery renders recognizably *this game* and not generic.

Only then does generation of real assets begin. This gate is what separates Crucible output from prototypy drift.

---

## 7. Two-game note (ties to Crucible §7)

- **Wayfinders (animals):** likely **Path A** — existing Wayfinders art + LoRA already proven; intake mostly formalizes the existing canon.
- **Deception game (train station):** likely **Path B** — new noir/period canon, no art yet; bootstrap a seed set via prompt scaffolding, curate, train, then generate the station props on-canon.
Two canons, two trigger words, zero cross-contamination — the same generalization proof Crucible is validated against.
