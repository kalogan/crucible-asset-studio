"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Object3D } from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { EditorScene, type TransformMode } from "./EditorScene";
import {
  SceneComposer,
  type InstanceTransform,
  type SceneInstance,
  type SceneLight,
} from "./SceneComposer";
import type { AssetSystem } from "@/lib/asset-system/schema";

export interface EditorModel {
  id: string;
  label: string;
  type: string;
  url: string;
}

export interface EditorViewProps {
  models: EditorModel[];
  /** Saved asset-systems for the active project (Scene-mode "Add system" picker). */
  systems?: AssetSystem[];
  /** Resolves a system part's raw `assetId` → model url. */
  assetUrlById?: Record<string, string>;
}

type EditorMode = "object" | "scene";

const MODES: TransformMode[] = ["translate", "rotate", "scale"];
const DEFAULT_COLOR = "#7c9cff";

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "model"
  );
}

/** Run GLTFExporter on an object subtree and download it as a .glb. */
function exportGLB(object: Object3D, filename: string, onDone: () => void): void {
  const exporter = new GLTFExporter();
  exporter.parse(
    object,
    (result) => {
      // binary:true → ArrayBuffer (GLB). Wrap in a Blob and trigger a download.
      const blob = new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      onDone();
    },
    onDone,
    { binary: true },
  );
}

export function EditorView({ models, systems = [], assetUrlById = {} }: EditorViewProps) {
  const reduced = useReducedMotion();
  const [editorMode, setEditorMode] = useState<EditorMode>("object");

  return (
    <div className="flex flex-col gap-4">
      {/* Mode toggle: the existing single-asset editor vs the multi-asset composer. */}
      <div role="group" aria-label="Editor mode" className="inline-flex w-fit overflow-hidden rounded-md border border-border">
        {(["object", "scene"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={editorMode === m}
            onClick={() => setEditorMode(m)}
            className={`min-h-9 px-4 text-sm capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
              editorMode === m
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {editorMode === "object" ? (
        <ObjectEditor models={models} reduced={reduced} />
      ) : (
        <SceneEditor
          models={models}
          systems={systems}
          assetUrlById={assetUrlById}
          reduced={reduced}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Object mode — the original single-asset editor (behavior unchanged) */
/* ------------------------------------------------------------------ */

function ObjectEditor({ models, reduced }: { models: EditorModel[]; reduced: boolean }) {
  const [selectedId, setSelectedId] = useState<string>(models[0]?.id ?? "");
  const [mode, setMode] = useState<TransformMode>("translate");
  // null = keep the model's original materials; a hex applies a live recolor.
  const [color, setColor] = useState<string | null>(null);
  // Bumped on Reset to remount the scene — reverts all transforms cleanly.
  const [resetKey, setResetKey] = useState(0);
  const [exporting, setExporting] = useState(false);

  const objectRef = useRef<Object3D | null>(null);

  const selected = models.find((m) => m.id === selectedId) ?? models[0] ?? null;

  const selectModel = useCallback((id: string) => {
    setSelectedId(id);
    setColor(null);
    setResetKey((k) => k + 1);
  }, []);

  const handleReset = useCallback(() => {
    setColor(null);
    setMode("translate");
    setResetKey((k) => k + 1);
  }, []);

  const handleExport = useCallback(() => {
    const object = objectRef.current;
    if (!object || !selected) return;
    setExporting(true);
    exportGLB(object, `${slugify(selected.label)}-edited.glb`, () => setExporting(false));
  }, [selected]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_1fr]">
      {/* Sidebar: pick which model to edit. */}
      <Card className="flex max-h-[70vh] flex-col overflow-hidden lg:max-h-[calc(100vh-12rem)]">
        <div className="border-b border-border p-3">
          <h2 className="text-sm font-medium text-foreground">Models</h2>
        </div>
        <ul className="flex-1 overflow-y-auto p-2" role="listbox" aria-label="Choose a model to edit">
          {models.map((m) => {
            const active = m.id === selected?.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => selectModel(m.id)}
                  className={`flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <span className="truncate" title={m.label}>
                    {m.label}
                  </span>
                  <span className="truncate text-[10px] text-muted-foreground/80">{m.type}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Main editor: canvas + controls. */}
      <div className="flex flex-col gap-4">
        <Card className="relative aspect-square w-full overflow-hidden lg:aspect-auto lg:h-[calc(100vh-16rem)] lg:min-h-[28rem]">
          {selected ? (
            <EditorScene
              key={`${selected.id}-${resetKey}`}
              url={selected.url}
              mode={mode}
              color={color}
              reduced={reduced}
              objectRef={objectRef}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">Select a model to edit.</p>
            </div>
          )}
        </Card>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          {/* Transform mode toggle. */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground" id="mode-label">
              Transform
            </span>
            <div
              role="group"
              aria-labelledby="mode-label"
              className="inline-flex overflow-hidden rounded-md border border-border"
            >
              {MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={`min-h-9 px-3 text-sm capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                    mode === m
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Recolor. */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recolor">Recolor</Label>
            <input
              id="recolor"
              type="color"
              value={color ?? DEFAULT_COLOR}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Recolor the model"
              className="h-9 w-16 cursor-pointer rounded-md border border-input bg-card p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              aria-label="Reset transforms and color"
            >
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleExport}
              disabled={exporting || !selected}
              aria-label="Download the edited model as a GLB file"
            >
              {exporting ? "Exporting…" : "Download GLB"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scene mode — multi-asset composer                                   */
/* ------------------------------------------------------------------ */

function SceneEditor({
  models,
  systems,
  assetUrlById,
  reduced,
}: {
  models: EditorModel[];
  systems: AssetSystem[];
  assetUrlById: Record<string, string>;
  reduced: boolean;
}) {
  const [instances, setInstances] = useState<SceneInstance[]>([]);
  // Lights contributed by imported systems — rendered on top of the studio IBL.
  const [sceneLights, setSceneLights] = useState<SceneLight[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [mode, setMode] = useState<TransformMode>("translate");
  const [exporting, setExporting] = useState(false);
  const [selectedSystemId, setSelectedSystemId] = useState<string>("");
  // Note surfaced when an imported system resolved no parts to local model urls.
  const [systemNote, setSystemNote] = useState<string | null>(null);

  // Stable instance ids: a monotonic counter (Math.random/Date.now are unavailable).
  const counterRef = useRef(0);
  // Root group containing every placed instance — the combined-GLB export target.
  const rootRef = useRef<Object3D | null>(null);

  const addInstance = useCallback((model: EditorModel) => {
    counterRef.current += 1;
    const instanceId = `inst-${counterRef.current}`;
    setInstances((prev) => [
      ...prev,
      {
        instanceId,
        url: model.url,
        label: model.label,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: 1,
      },
    ]);
    setSelectedInstanceId(instanceId);
  }, []);

  const removeInstance = useCallback((instanceId: string) => {
    setInstances((prev) => prev.filter((i) => i.instanceId !== instanceId));
    setSelectedInstanceId((cur) => (cur === instanceId ? null : cur));
  }, []);

  // Import a saved system: add one scene instance per part, placed at the part's
  // relative position/rotation/scale, with url resolved via assetUrlById. Parts
  // whose assetId isn't a local model are skipped; if none resolve we note it.
  const addSystem = useCallback(
    (system: AssetSystem) => {
      const parts = system.manifest.parts;
      const resolved = parts.flatMap((part) => {
        const url = assetUrlById[part.assetId];
        if (!url) return [];
        return [{ part, url }];
      });

      if (resolved.length === 0) {
        setSystemNote(
          `“${system.name}” has no parts that match this project's local models.`,
        );
        return;
      }

      const newInstances: SceneInstance[] = resolved.map(({ part, url }) => {
        counterRef.current += 1;
        return {
          instanceId: `inst-${counterRef.current}`,
          url,
          label: part.role ?? system.name,
          position: part.position,
          rotation: part.rotation,
          scale: part.scale,
        };
      });

      setInstances((prev) => [...prev, ...newInstances]);
      const last = newInstances[newInstances.length - 1];
      if (last) setSelectedInstanceId(last.instanceId);

      // Collect the system's manifest lights (if any) so they render in the scene.
      // Each is tagged with a unique id so "Clear scene" can drop them again.
      const manifestLights = system.manifest.lights ?? [];
      if (manifestLights.length > 0) {
        const newLights: SceneLight[] = manifestLights.map((light) => {
          counterRef.current += 1;
          const base: SceneLight = {
            lightId: `light-${counterRef.current}`,
            type: light.type,
            color: light.color,
            intensity: light.intensity,
          };
          if (light.position) base.position = light.position;
          return base;
        });
        setSceneLights((prev) => [...prev, ...newLights]);
      }

      const skipped = parts.length - resolved.length;
      const lightNote =
        manifestLights.length > 0 ? ` +${manifestLights.length} light(s)` : "";
      setSystemNote(
        skipped > 0
          ? `Added ${resolved.length} of ${parts.length} parts from “${system.name}” (${skipped} unresolved)${lightNote}.`
          : lightNote
            ? `Added ${resolved.length} part(s) from “${system.name}”${lightNote}.`
            : null,
      );
    },
    [assetUrlById],
  );

  // Clear the whole scene — placed instances AND any system-contributed lights.
  const clearScene = useCallback(() => {
    setInstances([]);
    setSceneLights([]);
    setSelectedInstanceId(null);
    setSystemNote(null);
  }, []);

  const selectedSystem = systems.find((s) => s.id === selectedSystemId) ?? null;

  // Persist a gizmo drag's result back into state so it survives re-render/re-selection.
  const handleTransformEnd = useCallback(
    (instanceId: string, t: InstanceTransform) => {
      setInstances((prev) =>
        prev.map((i) =>
          i.instanceId === instanceId
            ? { ...i, position: t.position, rotation: t.rotation, scale: t.scale }
            : i,
        ),
      );
    },
    [],
  );

  const handleExport = useCallback(() => {
    const object = rootRef.current;
    if (!object || instances.length === 0) return;
    setExporting(true);
    // Exporting the live root group serializes all instances with their applied
    // transforms (the gizmo mutates each instance group in place during the session).
    exportGLB(object, "scene.glb", () => setExporting(false));
  }, [instances.length]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_1fr]">
      <div className="flex flex-col gap-4">
        {/* System picker: import a saved bundle as one instance per part. */}
        {systems.length > 0 && (
          <Card className="flex flex-col gap-3 p-3">
            <h2 className="text-sm font-medium text-foreground">Add system</h2>
            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="system-picker">Saved system</Label>
                <select
                  id="system-picker"
                  value={selectedSystemId}
                  onChange={(e) => {
                    setSelectedSystemId(e.target.value);
                    setSystemNote(null);
                  }}
                  className="min-h-9 rounded-md border border-input bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select a system…</option>
                  {systems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.manifest.parts.length})
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={!selectedSystem}
                onClick={() => {
                  if (selectedSystem) addSystem(selectedSystem);
                }}
                aria-label="Add the selected system to the scene"
              >
                Add
              </Button>
            </div>
            {systemNote && (
              <p role="status" className="text-xs text-muted-foreground">
                {systemNote}
              </p>
            )}
          </Card>
        )}

        {/* Asset library: click an asset to add an instance to the scene. */}
        <Card className="flex max-h-[40vh] flex-col overflow-hidden lg:max-h-[calc((100vh-12rem)/2)]">
          <div className="border-b border-border p-3">
            <h2 className="text-sm font-medium text-foreground">Add to scene</h2>
          </div>
          <ul className="flex-1 overflow-y-auto p-2" aria-label="Add a model to the scene">
            {models.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => addInstance(m)}
                  className="flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Add ${m.label} to the scene`}
                >
                  <span className="truncate" title={m.label}>
                    {m.label}
                  </span>
                  <span className="truncate text-[10px] text-muted-foreground/80">{m.type}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {/* Placed instances: select one to attach its gizmo, or remove it. */}
        <Card className="flex max-h-[40vh] flex-col overflow-hidden lg:max-h-[calc((100vh-12rem)/2)]">
          <div className="border-b border-border p-3">
            <h2 className="text-sm font-medium text-foreground">
              Placed ({instances.length})
            </h2>
          </div>
          {instances.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">
              Click an asset above to place it.
            </p>
          ) : (
            <ul
              className="flex-1 overflow-y-auto p-2"
              role="listbox"
              aria-label="Select a placed instance"
            >
              {instances.map((inst) => {
                const active = inst.instanceId === selectedInstanceId;
                return (
                  <li key={inst.instanceId} className="flex items-center gap-1">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => setSelectedInstanceId(inst.instanceId)}
                      className={`flex min-w-0 flex-1 flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <span className="truncate" title={inst.label}>
                        {inst.label}
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeInstance(inst.instanceId)}
                      aria-label={`Remove ${inst.label} from the scene`}
                    >
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Main composer: canvas + controls. */}
      <div className="flex flex-col gap-4">
        <Card className="relative aspect-square w-full overflow-hidden lg:aspect-auto lg:h-[calc(100vh-16rem)] lg:min-h-[28rem]">
          {instances.length > 0 ? (
            <SceneComposer
              instances={instances}
              lights={sceneLights}
              selectedInstanceId={selectedInstanceId}
              mode={mode}
              reduced={reduced}
              rootRef={rootRef}
              onTransformEnd={handleTransformEnd}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Add assets from the left to compose a scene.
              </p>
            </div>
          )}
        </Card>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          {/* Transform mode toggle (applies to the selected instance's gizmo). */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground" id="scene-mode-label">
              Transform
            </span>
            <div
              role="group"
              aria-labelledby="scene-mode-label"
              className="inline-flex overflow-hidden rounded-md border border-border"
            >
              {MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={`min-h-9 px-3 text-sm capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                    mode === m
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearScene}
              disabled={instances.length === 0 && sceneLights.length === 0}
              aria-label="Clear all placed instances and system lights from the scene"
            >
              Clear scene
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleExport}
              disabled={exporting || instances.length === 0}
              aria-label="Download the composed scene as a single GLB file"
            >
              {exporting ? "Exporting…" : "Export scene GLB"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
