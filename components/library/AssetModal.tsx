"use client";

import {
  Suspense,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  OrbitControls,
  PerspectiveCamera,
  useGLTF,
} from "@react-three/drei";
import { Box3, Vector3, Group, Mesh, Color, type Material } from "three";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { saveAssetNotesAction } from "@/app/actions/library";
import type { LibraryItem } from "./LibraryGrid";

export interface ModelStats {
  triangles: number;
  meshes: number;
  colors: string[];
}

const FIT_SIZE = 2;

/** Walk a scene → triangle count + unique material colors (base + non-black emissive). */
function computeStats(root: Group): ModelStats {
  let triangles = 0;
  let meshes = 0;
  const colors = new Set<string>();
  const collect = (m: Material | Material[] | undefined) => {
    for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
      const c = (mat as { color?: Color }).color;
      if (c instanceof Color) colors.add(`#${c.getHexString()}`);
      const e = (mat as { emissive?: Color }).emissive;
      if (e instanceof Color && e.getHex() !== 0) colors.add(`#${e.getHexString()}`);
    }
  };
  root.traverse((o) => {
    if (o instanceof Mesh) {
      meshes++;
      const geo = o.geometry;
      const idx = geo.getIndex();
      const pos = geo.getAttribute("position");
      if (idx) triangles += idx.count / 3;
      else if (pos) triangles += pos.count / 3;
      collect(o.material as Material | Material[]);
    }
  });
  return { triangles: Math.round(triangles), meshes, colors: [...colors].slice(0, 12) };
}

function FocusModel({ url, onStats }: { url: string; onStats: (s: ModelStats) => void }) {
  const { scene } = useGLTF(url);
  const fitted = useMemo(() => {
    const obj = scene.clone(true);
    const box = new Box3().setFromObject(obj);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = FIT_SIZE / maxDim;
    obj.scale.setScalar(s);
    obj.position.set(-center.x * s, -center.y * s, -center.z * s);
    const wrap = new Group();
    wrap.add(obj);
    return wrap;
  }, [scene]);
  useEffect(() => {
    onStats(computeStats(fitted));
  }, [fitted, onStats]);
  return <primitive object={fitted} />;
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{children}</span>
    </div>
  );
}

export function AssetModal({ item, onClose }: { item: LibraryItem; onClose: () => void }) {
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [saveState, saveAction, saving] = useActionState(saveAssetNotesAction, null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Esc closes; focus the close button on open (lightweight focus management).
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const added = useMemo(() => {
    try {
      return new Date(item.createdAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return item.createdAt;
    }
  }, [item.createdAt]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Asset: ${item.label}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-background/80 backdrop-blur-sm"
      />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl md:flex-row lg:max-w-5xl xl:max-w-6xl">
        {/* Viewer */}
        <div className="relative aspect-square w-full bg-muted md:aspect-auto md:w-3/5">
          {item.format === "model" && item.url ? (
            <Canvas camera={{ position: [2.6, 1.9, 2.6], fov: 45 }} dpr={[1, 2]}>
              <PerspectiveCamera makeDefault position={[2.6, 1.9, 2.6]} fov={45} />
              <ambientLight intensity={0.5} />
              <directionalLight position={[5, 8, 5]} intensity={1.1} />
              <directionalLight position={[-5, 2, -3]} intensity={0.4} />
              <Suspense fallback={null}>
                <FocusModel url={item.url} onStats={setStats} />
                <Environment resolution={48} frames={1}>
                  <Lightformer intensity={3} position={[0, 5, 0]} scale={[8, 8, 1]} />
                  <Lightformer intensity={1.5} position={[5, 1, 4]} scale={[6, 6, 1]} />
                  <Lightformer intensity={1.5} position={[-5, 1, -4]} scale={[6, 6, 1]} />
                </Environment>
              </Suspense>
              <OrbitControls makeDefault enablePan enableZoom enableDamping />
            </Canvas>
          ) : item.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.url} alt={item.label} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No preview
            </div>
          )}
          {item.format === "model" && (
            <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[11px] text-muted-foreground">
              drag to rotate · scroll to zoom · right-drag to pan
            </p>
          )}
        </div>

        {/* Metadata + notes */}
        <div className="flex w-full flex-col gap-3 overflow-y-auto p-5 md:w-2/5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-serif text-xl text-foreground">{item.label}</h2>
              <Badge variant={item.source === "generated" ? "primary" : "accent"}>
                {item.source === "generated" ? "generated" : "procgen"}
              </Badge>
            </div>
            <Button
              ref={closeRef}
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </Button>
          </div>

          <div className="flex flex-col">
            <MetaRow label="Type">{item.type}</MetaRow>
            {item.tags.length > 0 && (
              <MetaRow label="Origin">{item.tags.join(" · ")}</MetaRow>
            )}
            <MetaRow label="Format">{item.format}</MetaRow>
            <MetaRow label="Added">{added}</MetaRow>
            {item.format === "model" && (
              <>
                <MetaRow label="Triangles">
                  {stats ? stats.triangles.toLocaleString() : "…"}
                </MetaRow>
                <MetaRow label="Meshes">{stats ? stats.meshes : "…"}</MetaRow>
                <MetaRow label="Colors">
                  {stats && stats.colors.length > 0 ? (
                    <span className="inline-flex flex-wrap justify-end gap-1">
                      {stats.colors.map((c) => (
                        <span
                          key={c}
                          title={c}
                          className="h-4 w-4 rounded-sm border border-border"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </span>
                  ) : (
                    "…"
                  )}
                </MetaRow>
              </>
            )}
            {item.artKitId && <MetaRow label="Art-kit id">{item.artKitId}</MetaRow>}
          </div>

          {/* Notes */}
          <form action={saveAction} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="source" value={item.source} />
            <label htmlFor="asset-notes" className="text-sm font-medium text-foreground">
              Notes
            </label>
            <textarea
              id="asset-notes"
              name="notes"
              defaultValue={item.notes}
              rows={4}
              placeholder="Director's notes — what to fix, reuse, restyle…"
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Saving…" : "Save notes"}
              </Button>
              {saveState?.ok && (
                <span className="text-sm text-accent" role="status">
                  Saved ✓
                </span>
              )}
              {saveState && !saveState.ok && (
                <span className="text-sm text-destructive" role="alert">
                  {saveState.error}
                </span>
              )}
            </div>
          </form>

          {item.url && (
            <a
              href={item.url}
              download
              className="mt-auto w-fit rounded text-sm text-primary underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Download {item.format === "model" ? "GLB" : "image"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
