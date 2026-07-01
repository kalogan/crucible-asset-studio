"use client";

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  OrbitControls,
  PerspectiveCamera,
  View,
  useGLTF,
} from "@react-three/drei";
import { Box3, Vector3, Group } from "three";
import { Badge } from "@/components/ui/badge";
import { buildFacets, filterByFacet } from "@/lib/library/filter";
import { AssetModal } from "./AssetModal";

export interface LibraryItem {
  id: string;
  label: string;
  type: string;
  source: "procgen" | "generated";
  format: "image" | "model" | "audio";
  url: string | null;
  tags: string[];
  notes: string;
  createdAt: string;
  artKitId: string | null;
}

/** Top-level asset kinds for the Library tabs. */
type LibKind = "all" | "image" | "model" | "audio" | "scene";
const KIND_TABS: readonly { key: LibKind; label: string }[] = [
  { key: "all", label: "All" },
  { key: "image", label: "2D Image" },
  { key: "model", label: "3D" },
  { key: "audio", label: "Audio" },
  { key: "scene", label: "Scenes" },
];
/** Which top-level kind an item is (3D incl. procgen models; Scenes = biome/zone captures). */
function kindOf(i: LibraryItem): Exclude<LibKind, "all"> {
  if (i.format === "audio") return "audio";
  if (i.format === "model") return "model";
  if (i.type === "biome") return "scene";
  return "image";
}

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

/** Target world-size (largest dimension) every model is normalized to, so tiles frame
 *  uniformly regardless of the source mesh's native scale (a tiny crystal vs a tall
 *  monument both fill the same box). */
const FIT_SIZE = 2;

/**
 * Load the GLB, then center it at the origin and scale its largest dimension to
 * FIT_SIZE — so every tile's fixed camera frames it consistently. Cloned so the same
 * url can safely mount in more than one view.
 */
function Model({ url }: { url: string }) {
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
  return <primitive object={fitted} />;
}

/** Per-view boundary — a bad model fails just its own tile, never the shared Canvas. */
class TileErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

/** The 3D contents rendered into one tile's tracked viewport. */
function TileScene({ url, reduced }: { url: string; reduced: boolean }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[2.3, 1.7, 2.3]} fov={45} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 5]} intensity={1.1} />
      <directionalLight position={[-5, 2, -3]} intensity={0.4} />
      <Suspense fallback={null}>
        <TileErrorBoundary>
          <Model url={url} />
        </TileErrorBoundary>
        {/* In-scene studio IBL (no external HDR) so PBR/TRELLIS meshes aren't black. */}
        <Environment resolution={24} frames={1}>
          <Lightformer intensity={3} position={[0, 5, 0]} scale={[8, 8, 1]} />
          <Lightformer intensity={1.5} position={[5, 1, 4]} scale={[6, 6, 1]} />
          <Lightformer intensity={1.5} position={[-5, 1, -4]} scale={[6, 6, 1]} />
        </Environment>
      </Suspense>
      {/* Drag to rotate inline; zoom/pan are off so the page still scrolls. A gentle
          auto-spin keeps tiles lively (off under reduced-motion). Full zoom/pan lives
          in the focus modal (opened via the View-details button). */}
      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={false}
        autoRotate={!reduced}
        autoRotateSpeed={1.1}
        enableDamping={!reduced}
      />
    </>
  );
}

export function LibraryGrid({ items }: { items: LibraryItem[] }) {
  // Top-level kind tab (2D / 3D / audio / scenes), then facet chips WITHIN that kind.
  const [kind, setKind] = useState<LibKind>("all");
  const [filter, setFilter] = useState<string>("all");
  const [focused, setFocused] = useState<LibraryItem | null>(null);
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  const kindItems = useMemo(
    () => (kind === "all" ? items : items.filter((i) => kindOf(i) === kind)),
    [items, kind],
  );
  // Facets (asset category + origin tags) rebuilt per kind so only relevant chips show.
  const facets = useMemo(() => buildFacets(kindItems), [kindItems]);
  const shown = filterByFacet(kindItems, filter);

  // Per-kind counts for the tab labels.
  const kindCount = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const i of items) {
      const k = kindOf(i);
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [items]);

  // Switching kind resets the facet filter so a stale facet can't hide everything.
  const selectKind = (k: LibKind) => {
    setKind(k);
    setFilter("all");
  };

  const chip = (key: string) =>
    `min-h-9 rounded-full border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      filter === key
        ? "border-primary bg-primary/10 text-primary"
        : "border-border text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div ref={containerRef} className="flex flex-col gap-4">
      {/* Top-level kind tabs (2D Image / 3D / Audio / Scenes). */}
      <div
        className="flex flex-wrap gap-1 border-b border-border"
        role="tablist"
        aria-label="Asset kind"
      >
        {KIND_TABS.map((t) => {
          const active = kind === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectKind(t.key)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}{" "}
              <span className="text-xs text-muted-foreground">({kindCount[t.key] ?? 0})</span>
            </button>
          );
        })}
      </div>

      {/* Facet chips — asset category / origin, scoped to the active kind. */}
      {facets.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          <button type="button" onClick={() => setFilter("all")} className={chip("all")}>
            All ({kindItems.length})
          </button>
          {facets.map((t) => (
            <button key={t} type="button" onClick={() => setFilter(t)} className={chip(t)}>
              {t}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground" role="status">
          Nothing here yet.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 min-[1440px]:grid-cols-6">
          {shown.map((i) => (
            <li
              key={`${i.source}-${i.id}`}
              className="group relative flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2"
            >
              {/* Hover-reveal magnifier → focus modal. z-20 lifts it above the fixed
                  preview canvas; stopPropagation keeps the click from starting an orbit
                  drag. Always visible on touch (no hover) for tap access. */}
              <button
                type="button"
                onClick={() => setFocused(i)}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label={`View details: ${i.label}`}
                className="absolute right-3 top-3 z-20 grid h-7 w-7 place-items-center rounded-md border border-border bg-background/80 text-muted-foreground opacity-0 backdrop-blur transition hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 [@media(hover:none)]:opacity-100"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.4-3.4" />
                </svg>
              </button>

              {i.format === "model" && i.url ? (
                <View
                  className="aspect-square w-full cursor-grab overflow-hidden rounded-md bg-muted active:cursor-grabbing"
                  aria-label={`3D model: ${i.label} (drag to rotate)`}
                >
                  <TileScene url={i.url} reduced={reduced} />
                </View>
              ) : i.format === "image" && i.url ? (
                <div className="aspect-square w-full overflow-hidden rounded-md bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.url} alt={i.label} className="h-full w-full object-contain" />
                </div>
              ) : i.format === "audio" && i.url ? (
                // Baked procgen synth (WAV) — an accessible inline player instead of a
                // 2D/3D viewer. A waveform glyph fills the square so the tile reads as
                // audio at a glance; the native controls sit below it.
                <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-md bg-muted p-2">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-10 w-10 text-muted-foreground"
                    aria-hidden="true"
                  >
                    <path d="M2 12h2l2-7 4 16 3-11 2 4h7" />
                  </svg>
                  <audio
                    controls
                    preload="none"
                    src={i.url}
                    aria-label={`Audio: ${i.label}`}
                    className="w-full"
                  >
                    <track kind="captions" />
                  </audio>
                </div>
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-md bg-muted">
                  <span className="text-xs font-medium text-muted-foreground">no preview</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-xs text-foreground" title={i.label}>
                  {i.label}
                </span>
                <Badge variant={i.source === "generated" ? "primary" : "accent"}>
                  {i.source === "generated" ? "gen" : "proc"}
                </Badge>
              </div>
              {(i.tags.length > 0 || i.type) && (
                <div
                  className="truncate text-[10px] text-muted-foreground"
                  title={[i.type, ...i.tags].filter(Boolean).join(" · ")}
                >
                  {[i.type, ...i.tags].filter(Boolean).join(" · ")}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* One shared WebGL context renders every tile's <View> into its tracked rect —
          avoids per-tile canvases (browsers cap WebGL contexts). Fixed + transparent +
          click-through; tiles are previews (auto-spin), interaction lives in the modal. */}
      <Canvas
        eventSource={containerRef as unknown as RefObject<HTMLElement>}
        eventPrefix="client"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <View.Port />
      </Canvas>

      {focused && <AssetModal item={focused} onClose={() => setFocused(null)} />}
    </div>
  );
}
