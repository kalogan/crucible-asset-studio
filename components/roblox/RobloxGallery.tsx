"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Canvas } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  OrbitControls,
  PerspectiveCamera,
  View,
} from "@react-three/drei";
import { Box3, Vector3, Group } from "three";
import { Badge } from "@/components/ui/badge";
import { LuauExport } from "./LuauExport";
import { buildDescriptor } from "@/lib/roblox/descriptorToThree";
import { ARCHETYPES, DESCRIPTORS } from "@/lib/roblox/fixtures";
import type { RobloxDescriptor } from "@/lib/roblox/schema";

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

/** Target world-size (largest dimension) every assembly is normalized to, so
 *  tiles frame uniformly regardless of a descriptor's stud size + scale. */
const FIT_SIZE = 2;

/**
 * Build the descriptor's greybox group, then center it at the origin and scale
 * its largest dimension to FIT_SIZE — same normalize-to-fit the GLB library
 * tiles use, so every tile's fixed camera frames consistently.
 */
function DescriptorMesh({ descriptor }: { descriptor: RobloxDescriptor }) {
  const fitted = useMemo(() => {
    const schema = ARCHETYPES[descriptor.archetype];
    const wrap = new Group();
    if (!schema) return wrap; // unknown archetype → empty (no render)

    const obj = buildDescriptor(descriptor, schema);
    const box = new Box3().setFromObject(obj);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = FIT_SIZE / maxDim;
    obj.scale.multiplyScalar(s);
    obj.position.set(-center.x * s, -center.y * s, -center.z * s);
    wrap.add(obj);
    return wrap;
  }, [descriptor]);

  return <primitive object={fitted} />;
}

/** The 3D contents rendered into one tile's tracked viewport. */
function TileScene({
  descriptor,
  reduced,
}: {
  descriptor: RobloxDescriptor;
  reduced: boolean;
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[2.3, 1.7, 2.3]} fov={45} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 5]} intensity={1.1} />
      <directionalLight position={[-5, 2, -3]} intensity={0.4} />
      <DescriptorMesh descriptor={descriptor} />
      {/* In-scene studio IBL (no external HDR fetch) so the MeshStandard greybox
          reads as a lit surface rather than flat black. */}
      <Environment resolution={24} frames={1}>
        <Lightformer intensity={3} position={[0, 5, 0]} scale={[8, 8, 1]} />
        <Lightformer intensity={1.5} position={[5, 1, 4]} scale={[6, 6, 1]} />
        <Lightformer intensity={1.5} position={[-5, 1, -4]} scale={[6, 6, 1]} />
      </Environment>
      {/* Drag to rotate inline; zoom/pan off so the page still scrolls. Gentle
          auto-spin keeps tiles lively (off under reduced-motion). */}
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

export function RobloxGallery() {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="flex flex-col gap-4">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DESCRIPTORS.map((d) => {
          const schema = ARCHETYPES[d.archetype];
          return (
            <li
              key={d.id}
              className="group relative flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2"
            >
              <View
                className="aspect-square w-full cursor-grab overflow-hidden rounded-md bg-muted active:cursor-grabbing"
                aria-label={`Greybox descriptor: ${d.id} (${d.archetype}) — drag to rotate`}
              >
                <TileScene descriptor={d} reduced={reduced} />
              </View>
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-xs text-foreground" title={d.id}>
                  {d.id}
                </span>
                <Badge variant="outline">{d.archetype}</Badge>
              </div>
              {schema ? <LuauExport descriptor={d} schema={schema} /> : null}
            </li>
          );
        })}
      </ul>

      {/* One shared WebGL context renders every tile's <View> into its tracked
          rect — avoids per-tile canvases (browsers cap WebGL contexts). Fixed +
          transparent + click-through. */}
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
    </div>
  );
}
