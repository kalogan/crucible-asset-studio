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
import type { TransformMode } from "./EditorScene";

export interface SceneInstance {
  instanceId: string;
  url: string;
  label: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

/** Transform read back from a gizmo drag so it persists across re-renders/re-selection. */
export interface InstanceTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

export interface SceneComposerProps {
  instances: SceneInstance[];
  selectedInstanceId: string | null;
  mode: TransformMode;
  reduced: boolean;
  /** Root group containing every placed instance — the GLTFExporter target. */
  rootRef: React.MutableRefObject<Object3D | null>;
  /** Fired at gizmo drag end with the selected instance's live transform. */
  onTransformEnd: (instanceId: string, transform: InstanceTransform) => void;
}

export function SceneComposer({
  instances,
  selectedInstanceId,
  mode,
  reduced,
  rootRef,
  onTransformEnd,
}: SceneComposerProps) {
  const groupRef = (rootRef as unknown) as RefObject<Group>;

  // Per-instance wrapper groups. The gizmo attaches to whichever one is selected; on
  // drag end we read its transform back out so state survives re-render / re-selection.
  const instanceRefs = useRef<Map<string, Group>>(new Map());

  // Suspend OrbitControls while a gizmo is dragged (same pattern as EditorScene).
  const [dragging, setDragging] = useState(false);

  const selectedGroup =
    selectedInstanceId !== null ? instanceRefs.current.get(selectedInstanceId) ?? null : null;

  const handleDragEnd = () => {
    setDragging(false);
    if (selectedInstanceId === null) return;
    const g = instanceRefs.current.get(selectedInstanceId);
    if (!g) return;
    onTransformEnd(selectedInstanceId, {
      position: [g.position.x, g.position.y, g.position.z],
      rotation: [g.rotation.x, g.rotation.y, g.rotation.z],
      // `scale: number` per the model — gizmo scaling stays effectively uniform; read x.
      scale: g.scale.x,
    });
  };

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <color attach="background" args={["#18181b"]} />
      <PerspectiveCamera makeDefault position={[4, 3, 4]} fov={45} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 5]} intensity={1.1} />
      <directionalLight position={[-5, 2, -3]} intensity={0.4} />

      <Suspense fallback={null}>
        {/* Root group: the single export target containing all placed instances. */}
        <group ref={groupRef}>
          {instances.map((inst) => (
            <group
              key={inst.instanceId}
              ref={(g) => {
                if (g) instanceRefs.current.set(inst.instanceId, g);
                else instanceRefs.current.delete(inst.instanceId);
              }}
              position={inst.position}
              rotation={inst.rotation}
              scale={inst.scale}
            >
              <Model url={inst.url} />
            </group>
          ))}
        </group>

        {/* In-scene studio IBL (no external HDR) so PBR/TRELLIS meshes aren't black. */}
        <Environment resolution={64} frames={1}>
          <Lightformer intensity={3} position={[0, 5, 0]} scale={[8, 8, 1]} />
          <Lightformer intensity={1.5} position={[5, 1, 4]} scale={[6, 6, 1]} />
          <Lightformer intensity={1.5} position={[-5, 1, -4]} scale={[6, 6, 1]} />
        </Environment>
      </Suspense>

      {/* Gizmo attaches to the selected instance's wrapper group only. mouseDown/Up
          bracket a drag (drei's `dragging-changed` bridge); flip `dragging` to suspend
          orbit, and read the live transform back into state on release. */}
      {selectedGroup && (
        <TransformControls
          // Keyed by instance so the gizmo re-binds cleanly when selection changes.
          key={selectedInstanceId ?? "none"}
          object={selectedGroup}
          mode={mode}
          onMouseDown={() => setDragging(true)}
          onMouseUp={handleDragEnd}
        />
      )}

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
