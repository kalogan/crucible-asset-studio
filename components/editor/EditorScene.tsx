"use client";

import { Suspense, useRef, useState, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  OrbitControls,
  PerspectiveCamera,
  TransformControls,
} from "@react-three/drei";
import { Group, type Object3D } from "three";
import { Model } from "./Model";

export type TransformMode = "translate" | "rotate" | "scale";

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
