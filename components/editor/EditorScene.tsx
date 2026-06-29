"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  OrbitControls,
  PerspectiveCamera,
  TransformControls,
  useGLTF,
} from "@react-three/drei";
import {
  Box3,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Material,
  type Object3D,
} from "three";

export type TransformMode = "translate" | "rotate" | "scale";

/** Largest-dimension world size every model is normalized to, matching LibraryGrid. */
const FIT_SIZE = 2;

/** Narrow an Object3D to a Mesh (guards the `.material` access below). */
function isMesh(obj: Object3D): obj is Mesh {
  return (obj as Mesh).isMesh === true;
}

/** Apply a hex color to every mesh material in the subtree. Each material is cloned
 *  on first recolor so the shared cache (useGLTF) and other views stay untouched, then
 *  its `.color` is set. `null` color is a no-op (used to mean "original colors"). */
function applyColor(root: Object3D, hex: string | null): void {
  if (hex === null) return;
  const next = new Color(hex);
  root.traverse((obj) => {
    if (!isMesh(obj)) return;
    const mat = obj.material;
    obj.material = Array.isArray(mat)
      ? mat.map((m) => recolor(m, next))
      : recolor(mat, next);
  });
}

function recolor(mat: Material, color: Color): Material {
  const cloned = mat.clone();
  if (cloned instanceof MeshStandardMaterial || "color" in cloned) {
    (cloned as MeshStandardMaterial).color = color.clone();
  }
  return cloned;
}

/**
 * Loads the GLB and normalizes it (center + uniform scale) into a wrapper Group, so any
 * asset frames consistently. The wrapper is exposed via `objectRef` so the parent can
 * attach TransformControls, recolor, reset and export the *edited* object. Re-applies the
 * picked color on every render so the live color input reflects immediately.
 */
function Model({
  url,
  color,
  objectRef,
}: {
  url: string;
  color: string | null;
  objectRef: React.MutableRefObject<Object3D | null>;
}) {
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

  // Apply recolor whenever the picked color (or the loaded model) changes.
  useEffect(() => {
    applyColor(fitted, color);
  }, [fitted, color]);

  // Expose the editable object to the parent (transform/reset/export targets).
  useEffect(() => {
    objectRef.current = fitted;
    return () => {
      if (objectRef.current === fitted) objectRef.current = null;
    };
  }, [fitted, objectRef]);

  return <primitive object={fitted} />;
}

export interface EditorSceneProps {
  url: string;
  mode: TransformMode;
  color: string | null;
  reduced: boolean;
  objectRef: React.MutableRefObject<Object3D | null>;
}

export function EditorScene({ url, mode, color, reduced, objectRef }: EditorSceneProps) {
  // The wrapper group TransformControls attaches to. Lives in scene graph; the loaded
  // model mounts inside it (via objectRef) so transforms apply to the whole asset.
  const targetRef = useRef<Group>(null);

  // While the gizmo is dragged, disable OrbitControls so the two don't consume the same
  // pointer drag and fight. drei's TransformControls fires mouseDown/mouseUp (its bridge
  // for the underlying `dragging-changed` event) at drag start/end.
  const [dragging, setDragging] = useState(false);

  return (
    <Canvas
      // Remount per-url so the loaded model, controls and gizmo reset cleanly.
      key={url}
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <color attach="background" args={["#18181b"]} />
      <PerspectiveCamera makeDefault position={[3, 2.2, 3]} fov={45} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 5]} intensity={1.1} />
      <directionalLight position={[-5, 2, -3]} intensity={0.4} />

      <Suspense fallback={null}>
        <group ref={targetRef}>
          <Model url={url} color={color} objectRef={objectRef} />
        </group>
        {/* In-scene studio IBL (no external HDR) so PBR/TRELLIS meshes aren't black. */}
        <Environment resolution={64} frames={1}>
          <Lightformer intensity={3} position={[0, 5, 0]} scale={[8, 8, 1]} />
          <Lightformer intensity={1.5} position={[5, 1, 4]} scale={[6, 6, 1]} />
          <Lightformer intensity={1.5} position={[-5, 1, -4]} scale={[6, 6, 1]} />
        </Environment>
      </Suspense>

      {/* Gizmo attaches to the wrapper group. mouseDown/Up bracket a drag (drei's bridge
          for `dragging-changed`); we flip `dragging` to suspend orbit during a drag. */}
      <TransformControls
        object={targetRef as unknown as RefObject<Object3D>}
        mode={mode}
        onMouseDown={() => setDragging(true)}
        onMouseUp={() => setDragging(false)}
      />

      <OrbitControls
        makeDefault
        enabled={!dragging}
        enablePan
        enableZoom
        enableDamping={!reduced}
        autoRotate={false}
      />
    </Canvas>
  );
}
