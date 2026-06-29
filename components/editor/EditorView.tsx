"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Object3D } from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { EditorScene, type TransformMode } from "./EditorScene";

export interface EditorModel {
  id: string;
  label: string;
  type: string;
  url: string;
}

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

export function EditorView({ models }: { models: EditorModel[] }) {
  const reduced = useReducedMotion();
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
    const exporter = new GLTFExporter();
    exporter.parse(
      object,
      (result) => {
        // binary:true → ArrayBuffer (GLB). Wrap in a Blob and trigger a download.
        const blob = new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `${slugify(selected.label)}-edited.glb`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
        setExporting(false);
      },
      () => setExporting(false),
      { binary: true },
    );
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
