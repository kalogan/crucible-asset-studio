"use client";

import {
  Suspense,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  OrbitControls,
  PerspectiveCamera,
  useAnimations,
  useGLTF,
} from "@react-three/drei";
import { Box3, Vector3, Group, Mesh, Color, type Material } from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { saveAssetNotesAction } from "@/app/actions/library";
import { rigAssetAction, type RigResult } from "@/app/actions/rig";
import {
  getAssetVersions,
  promoteAssetVersion,
  type AssetVersion,
} from "@/app/actions/asset-versions";
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

function FocusModel({
  url,
  onStats,
  onClips,
  activeClip,
}: {
  url: string;
  onStats: (s: ModelStats) => void;
  onClips: (names: string[]) => void;
  activeClip: string | null;
}) {
  const { scene, animations } = useGLTF(url);
  const groupRef = useRef<Group>(null);
  // SkeletonUtils.clone (not scene.clone) so rigged/skinned meshes keep a working
  // skeleton — required for animation playback to deform correctly.
  const fitted = useMemo(() => {
    const obj = cloneSkeleton(scene);
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

  const { actions, names } = useAnimations(animations, groupRef);

  useEffect(() => {
    onStats(computeStats(fitted));
  }, [fitted, onStats]);
  useEffect(() => {
    onClips(names);
  }, [names, onClips]);
  useEffect(() => {
    if (!activeClip) return;
    const action = actions[activeClip];
    if (!action) return;
    action.reset().fadeIn(0.25).play();
    return () => {
      action.fadeOut(0.25);
    };
  }, [activeClip, actions]);

  return (
    <group ref={groupRef}>
      <primitive object={fitted} />
    </group>
  );
}

// ── Viewer lighting presets (Asset-Forge-style) ──────────────────────────────
type EnvPreset = "studio" | "night" | "warm";
type BrightPreset = "dark" | "studio" | "bright";

const ENV_OPTIONS = ["studio", "night", "warm"] as const;
const BRIGHT_OPTIONS = ["dark", "studio", "bright"] as const;

interface Former {
  intensity: number;
  color: string;
}
interface EnvConfig {
  /** Backdrop when "Dark background" is on. */
  bg: string;
  ambient: number;
  keyColor: string;
  keyIntensity: number;
  fillIntensity: number;
  /** In-scene IBL cards: [top, right, left] — no external HDR fetch. */
  formers: [Former, Former, Former];
}

const ENV_PRESETS: Record<EnvPreset, EnvConfig> = {
  studio: {
    bg: "#18181b",
    ambient: 0.5,
    keyColor: "#ffffff",
    keyIntensity: 1.1,
    fillIntensity: 0.4,
    formers: [
      { intensity: 3, color: "#ffffff" },
      { intensity: 1.5, color: "#ffffff" },
      { intensity: 1.5, color: "#ffffff" },
    ],
  },
  night: {
    bg: "#090c15",
    ambient: 0.26,
    keyColor: "#b3c4ff",
    keyIntensity: 0.9,
    fillIntensity: 0.22,
    formers: [
      { intensity: 1.8, color: "#adc2ff" },
      { intensity: 0.8, color: "#8098d8" },
      { intensity: 0.7, color: "#39477a" },
    ],
  },
  warm: {
    bg: "#1b1410",
    ambient: 0.46,
    keyColor: "#ffd8a0",
    keyIntensity: 1.3,
    fillIntensity: 0.45,
    formers: [
      { intensity: 3, color: "#ffe8c6" },
      { intensity: 1.6, color: "#ffcf9a" },
      { intensity: 1.1, color: "#c9895a" },
    ],
  },
};

/** Brightness presets → tone-mapping exposure. */
const BRIGHT_EXPOSURE: Record<BrightPreset, number> = { dark: 0.7, studio: 1, bright: 1.45 };

/** The env preset's real-time key/fill + in-scene IBL. */
function ViewerLighting({ cfg }: { cfg: EnvConfig }) {
  const [top, right, left] = cfg.formers;
  return (
    <>
      <ambientLight intensity={cfg.ambient} />
      <directionalLight position={[5, 8, 5]} intensity={cfg.keyIntensity} color={cfg.keyColor} />
      <directionalLight position={[-5, 2, -3]} intensity={cfg.fillIntensity} color={cfg.keyColor} />
      <Environment resolution={48} frames={1}>
        <Lightformer intensity={top.intensity} color={top.color} position={[0, 5, 0]} scale={[8, 8, 1]} />
        <Lightformer intensity={right.intensity} color={right.color} position={[5, 1, 4]} scale={[6, 6, 1]} />
        <Lightformer intensity={left.intensity} color={left.color} position={[-5, 1, -4]} scale={[6, 6, 1]} />
      </Environment>
    </>
  );
}

/** Live-drives the renderer's tone-mapping exposure from the Brightness preset. */
function ExposureCtl({ value }: { value: number }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMappingExposure = value;
  }, [gl, value]);
  return null;
}

/** A small segmented preset selector (labeled, aria-pressed). */
function SegGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">{label}</span>
      <div className="flex overflow-hidden rounded-md border border-border/70">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            aria-pressed={value === o}
            className={`flex-1 px-2 py-1 text-[11px] capitalize transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              value === o ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

/** An accessible on/off row (role=switch). */
function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-[11px] text-muted-foreground">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-4 w-7 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
          checked ? "bg-primary/70" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-background transition-all ${
            checked ? "left-3.5" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

type RigPose = "adown" | "tpose";
const RIG_POSES: readonly RigPose[] = ["adown", "tpose"];

/**
 * "Rig this" — one-click auto-rig for an un-rigged model asset. Shells out (server-side,
 * LOCAL only) to the auto-rig CLI + Blender, then re-imports the rigged GLB as a new asset.
 * Long-running (~30-60s); shows in-progress + a link to the result (or the surfaced error).
 */
function RigThis({ assetId }: { assetId: string }) {
  const [pose, setPose] = useState<RigPose>("adown");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RigResult | null>(null);

  const onRig = async () => {
    setBusy(true);
    setResult(null);
    try {
      setResult(await rigAssetAction({ assetId, pose }));
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : "Rig failed." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">Rig this</span>
        <SegGroup<RigPose>
          label="Pose"
          options={RIG_POSES}
          value={pose}
          onChange={setPose}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Auto-rig a humanoid armature + idle/cast/guard/strike/hit clips, then re-import as a
        new asset. Local studio only (needs Blender) · ~30–60s.
      </p>
      <Button type="button" size="sm" onClick={onRig} disabled={busy} className="w-fit">
        {busy ? "Rigging… (~30–60s)" : "Rig this"}
      </Button>
      {result?.ok && (
        <p className="text-sm text-accent" role="status">
          Rigged ✓ — created{" "}
          <a
            href={result.url}
            className="underline underline-offset-2 hover:opacity-80"
            target="_blank"
            rel="noreferrer"
          >
            {result.label}
          </a>
          . Reload the library to see it in the grid.
        </p>
      )}
      {result && !result.ok && (
        <p className="whitespace-pre-wrap text-sm text-destructive" role="alert">
          {result.error}
        </p>
      )}
    </div>
  );
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
  const [clipNames, setClipNames] = useState<string[]>([]);
  const [activeClip, setActiveClip] = useState<string | null>(null);
  // Viewer lighting presets (Asset-Forge-style). Defaults match the prior fixed look.
  const [envPreset, setEnvPreset] = useState<EnvPreset>("studio");
  const [brightPreset, setBrightPreset] = useState<BrightPreset>("studio");
  const [autoRotate, setAutoRotate] = useState(false);
  const [darkBg, setDarkBg] = useState(true);
  const [saveState, saveAction, saving] = useActionState(saveAssetNotesAction, null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Version history (lineage = project + art_kit_id). Empty unless there are ≥2 versions.
  const [versions, setVersions] = useState<AssetVersion[]>([]);
  const [activeId, setActiveId] = useState(item.id);
  const [promoting, setPromoting] = useState(false);

  // When a model's clips load, auto-play an idle-ish one (else the first) so it's lively.
  const onClips = useCallback((names: string[]) => {
    setClipNames(names);
    setActiveClip((cur) => {
      if (cur && names.includes(cur)) return cur;
      if (names.length === 0) return null;
      const idle = names.find((n) => /idle|survey|rest|breath/i.test(n));
      return idle ?? names[0] ?? null;
    });
  }, []);

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

  // Load the lineage's versions on open; flip through them by swapping the viewed URL.
  useEffect(() => {
    let alive = true;
    getAssetVersions(item.id).then((v) => {
      if (alive) setVersions(v);
    });
    return () => {
      alive = false;
    };
  }, [item.id]);

  const baseUrl = item.url;
  const activeVersion = versions.find((v) => v.id === activeId);
  // The viewed URL follows the selected version; falls back to the item's own URL.
  const activeUrl = activeVersion?.url ?? baseUrl;
  const stepVersion = (dir: number) => {
    if (versions.length < 2) return;
    const idx = versions.findIndex((v) => v.id === activeId);
    const next = versions[(idx + dir + versions.length) % versions.length];
    if (next) setActiveId(next.id);
  };
  const promote = async () => {
    setPromoting(true);
    try {
      await promoteAssetVersion(activeId);
      setVersions(await getAssetVersions(item.id));
    } finally {
      setPromoting(false);
    }
  };

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
          {item.format === "model" && activeUrl ? (
            <>
              <Canvas camera={{ position: [2.6, 1.9, 2.6], fov: 45 }} dpr={[1, 2]}>
                <color attach="background" args={[darkBg ? ENV_PRESETS[envPreset].bg : "#3f3f46"]} />
                <PerspectiveCamera makeDefault position={[2.6, 1.9, 2.6]} fov={45} />
                <ExposureCtl value={BRIGHT_EXPOSURE[brightPreset]} />
                <ViewerLighting cfg={ENV_PRESETS[envPreset]} />
                <Suspense fallback={null}>
                  <FocusModel
                    url={activeUrl}
                    onStats={setStats}
                    onClips={onClips}
                    activeClip={activeClip}
                  />
                </Suspense>
                <OrbitControls
                  makeDefault
                  enablePan
                  enableZoom
                  enableDamping
                  autoRotate={autoRotate}
                  autoRotateSpeed={1.4}
                />
              </Canvas>
              {/* Lighting preset panel (Asset-Forge-style) */}
              <div className="absolute right-2 top-2 z-10 flex w-40 flex-col gap-2 rounded-lg border border-border/60 bg-background/75 p-2.5 backdrop-blur">
                <SegGroup label="Environment" options={ENV_OPTIONS} value={envPreset} onChange={setEnvPreset} />
                <SegGroup label="Brightness" options={BRIGHT_OPTIONS} value={brightPreset} onChange={setBrightPreset} />
                <div className="mt-0.5 flex flex-col gap-1.5 border-t border-border/50 pt-2">
                  <ToggleRow label="Auto-rotate" checked={autoRotate} onChange={setAutoRotate} />
                  <ToggleRow label="Dark background" checked={darkBg} onChange={setDarkBg} />
                </div>
              </div>
            </>
          ) : item.format === "audio" && activeUrl ? (
            <div className="flex h-full items-center justify-center p-8">
              <audio controls src={activeUrl} className="w-full max-w-md">
                <track kind="captions" />
              </audio>
            </div>
          ) : activeUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={activeUrl} alt={item.label} className="h-full w-full object-contain" />
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

            {/* Version flipper — flip through / compare past versions of this asset. */}
            {versions.length > 1 && activeVersion && (
              <div className="my-2 rounded-md border border-border bg-muted/40 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Versions</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => stepVersion(1)}
                      aria-label="Older version"
                      className="rounded px-1.5 text-muted-foreground hover:text-foreground"
                    >
                      ‹
                    </button>
                    <span className="text-xs tabular-nums">
                      v{activeVersion.version}{" "}
                      <span className="text-muted-foreground">/ {versions.length}</span>
                      {activeVersion.isCurrent && (
                        <span className="ml-1 text-emerald-500">· current</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => stepVersion(-1)}
                      aria-label="Newer version"
                      className="rounded px-1.5 text-muted-foreground hover:text-foreground"
                    >
                      ›
                    </button>
                  </div>
                </div>
                {!activeVersion.isCurrent && (
                  <button
                    type="button"
                    onClick={promote}
                    disabled={promoting}
                    className="mt-1 w-full rounded bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20 disabled:opacity-50"
                  >
                    {promoting ? "Setting…" : "Make this the current version"}
                  </button>
                )}
              </div>
            )}

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

          {/* Animations — play any embedded glTF clip (idle/walk/attack/dance/…). */}
          {clipNames.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                Animations ({clipNames.length})
              </span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Animation clips">
                {clipNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setActiveClip(name)}
                    aria-pressed={activeClip === name}
                    className={`min-h-8 rounded-full border px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      activeClip === name
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Rig this — only for model assets with no clips yet (i.e. not already rigged).
              Runs the local auto-rig pipeline server-side + re-imports the rigged GLB. */}
          {item.format === "model" && activeUrl && clipNames.length === 0 && (
            <RigThis assetId={item.id} />
          )}

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

          {activeUrl && (
            <a
              href={activeUrl}
              download
              className="mt-auto w-fit rounded text-sm text-primary underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Download {item.format === "model" ? "GLB" : item.format === "audio" ? "WAV" : "image"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
