# ADDENDUM: Registry Visualization (Crucible "Kits" tab)

**Version:** v1
**Extends:** `HANDOFF_kit_registry.md` v2 (the dashboard described in §8, now sited as a tab inside Crucible)
**Relationship to Crucible:** a new **read-only tab** in `crucible-studio`. Crucible *displays* the registry; it does not own or manage it.

---

## 0. Intent

A "Kits" tab in Crucible that visualizes **all your tools, kits, and systems** and **which projects consume them** — the system→kit→tool composition graph plus the reverse index ("GLBViewer → used by Crucible, Wayfinders, deception-station, …"). This is the kit-registry handoff's dashboard (§8), rendered as a Crucible tab rather than a standalone app.

No new data model: it renders metadata you already store — each unit's `tier` + `composes`, each project's `package.json` deps (linked units) and `.kits` breadcrumb (stamped units).

---

## 1. Non-Goals (the fence)

- **Read-only. It visualizes; it never edits.** No creating, editing, scaffolding, or configuring kits from this tab. Authoring stays in the monorepo + CLI (per the kit handoff). The instant this tab grows a write action, it's the editor tar pit the kit handoff explicitly fenced off.
- **Not the registry's home.** The registry lives in `~/kit-registry` (the monorepo). This tab is a viewer that reads from it, not a second source of truth.
- **The only "action" allowed** is the same one the kit dashboard already permits: launching a *stamped* scaffold via the existing CLI — and even that is optional for v1. Default to pure visualization first.

---

## 2. Architecture (three pieces, cleanly separated)

```
  ~/kit-registry (monorepo manifests: tier + composes + distribution)
  + project repos (package.json deps + .kits breadcrumbs)
            │
            ▼
   ┌──────────────────┐      ┌──────────────────────┐      ┌──────────────────┐
   │  Scanner module  │ ───▶ │ registry-graph.json  │ ───▶ │ graph-viewer KIT │
   │  (Node, headless)│      │   (generated cache)  │      │  (renders graph) │
   └──────────────────┘      └──────────────────────┘      └──────────────────┘
                                                                     │
                                                          used by ── ▼
                                                            Crucible "Kits" tab
```

1. **Scanner module** (Node, standalone) — walks the monorepo manifests + the project repos, builds the graph (nodes = units + projects; edges = `composes` and "project uses unit"), emits `registry-graph.json`. Headless and reusable — it must NOT live tangled inside Crucible's asset code, so the same scanner can feed a standalone view or any other dashboard later.
2. **`registry-graph.json`** — the generated cache the UI renders. Re-scan on demand / on tab load. Not hand-maintained.
3. **graph-viewer kit** — the rendering component (see §3).
4. **Crucible "Kits" tab** — thin: triggers a scan, loads `registry-graph.json`, renders it via the graph-viewer kit.

---

## 3. The graph-viewer is itself a kit (dogfooding)

Build the visualization as a reusable **kit** in the registry — a `graph-viewer` (D3 or similar) that takes a graph JSON and renders tiered nodes + edges. Then Crucible's Kits tab *uses that kit* to render the registry.

This is the system eating its own dog food: the tool that visualizes your kits is itself a kit in the thing it visualizes — and it shows up in its own graph. Bonus: if you later want this graph in another project's dashboard, you just **link** the kit. (It's a kit, tier = kit, `composes` = whatever graph/layout tools it uses.)

---

## 4. Scope: registry + consumers

The scanner walks **both** the monorepo and your project repos, so the views answer "what exists" *and* "where is it used":

- **Monorepo** → every unit's `tier`, `composes`, `distribution`, version.
- **Project repos** → each project's `package.json` (linked units + shared version) and `.kits` breadcrumb (stamped units + vars).

This is the "where are my capabilities sprinkled" view you originally wanted — it requires the scanner to know your project roots (reuse the kit handoff's `config.json` scan roots).

---

## 5. Views

- **Composition graph** — the payoff: systems (top) → kits (middle) → tools (bottom), edges = `composes`. The tiered layout from the kit framework, made visible.
- **Reverse index** — pick any unit → every project and parent-unit that uses it, with linked-vs-stamped status and version ("GLBViewer — linked, v1.2, used by Crucible + Wayfinders + 3 others").
- **Project map** — per project: its tier-stack of units, linked vs stamped, last activity.
- *(Optional, deferred)* **Launcher** — trigger a stamped scaffold via the existing CLI. Off by default for v1; add only if you want it, and keep it delegating to the CLI, never an in-tab editor.

---

## 6. Where it slots into the build

This is additive and late — it has nothing to visualize until kits exist, so it comes **after** the registry has real units in it.

- Prereq: the kit registry exists with a few real units (e.g. Crucible's own GLBViewer + executor-adapter extractions).
- Build: scanner module → `registry-graph.json` → `graph-viewer` kit → Crucible "Kits" tab.
- Fits naturally as a **Crucible Phase 3+ / polish** item, or whenever the registry has enough units to make the graph worth looking at. Don't front-load it.

---

## 7. Open Decisions

- **Scan trigger:** on tab load vs. a manual "re-scan" button vs. a file-watcher. (Lean: manual button + on-load, no watcher.)
- **Graph lib for the viewer kit:** D3 force/tree vs. a lighter layout. Pick based on graph size; start simple.
- **Launcher in v1:** include the (CLI-delegating) scaffold launcher, or pure-visualization only. (Lean: pure visualization for v1.)
- **Standalone too?** Since the scanner + viewer kit are decoupled, you *can* also ship a standalone view. Decide if Crucible-tab-only is enough for now (it is).
