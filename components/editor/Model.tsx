"use client";

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
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

/** Largest-dimension world size every model is normalized to, matching LibraryGrid. */
export const FIT_SIZE = 2;

/** Narrow an Object3D to a Mesh (guards the `.material` access below). */
function isMesh(obj: Object3D): obj is Mesh {
  return (obj as Mesh).isMesh === true;
}

/** Apply a hex color to every mesh material in the subtree. Each material is cloned
 *  on first recolor so the shared cache (useGLTF) and other views stay untouched, then
 *  its `.color` is set. `null` color is a no-op (used to mean "original colors"). */
export function applyColor(root: Object3D, hex: string | null): void {
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
 * asset frames consistently. Shared by the single-object editor (EditorScene) and the
 * scene composer (SceneComposer).
 *
 * Optional `objectRef` exposes the normalized wrapper so a parent can attach
 * TransformControls / recolor / reset / export the *edited* object (single-object editor).
 * Optional `color` applies a live recolor; `null`/omitted keeps the original materials.
 */
export function Model({
  url,
  color = null,
  objectRef,
}: {
  url: string;
  color?: string | null;
  objectRef?: React.MutableRefObject<Object3D | null>;
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
    if (!objectRef) return;
    objectRef.current = fitted;
    return () => {
      if (objectRef.current === fitted) objectRef.current = null;
    };
  }, [fitted, objectRef]);

  return <primitive object={fitted} />;
}
