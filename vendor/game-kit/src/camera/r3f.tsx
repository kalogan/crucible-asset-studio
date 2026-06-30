/**
 * Camera controllers — react-three-fiber variant.
 *
 * Thin hooks wrapping the vanilla controllers (createOrbitCamera /
 * createChaseCamera / createFirstPersonCamera). Each hook grabs the active
 * `useThree().camera`, builds the controller once via `useMemo`, then drives it
 * every frame from `useFrame`. The hooks supply input/target via getter
 * callbacks so the parent never has to re-render to push new state.
 *
 * The controllers require a PerspectiveCamera; we guard at construction so a
 * misconfigured <Canvas/> (orthographic) fails loudly rather than silently.
 *
 * Requires the react + @react-three/fiber peer deps (optional in package.json).
 */

import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  createOrbitCamera,
  createChaseCamera,
  createFirstPersonCamera,
  type OrbitCamera,
  type OrbitCameraOptions,
  type ChaseCamera,
  type ChaseCameraOptions,
  type FirstPersonCamera,
  type FirstPersonCameraOptions,
  type CameraInput,
} from './index.js';
import type { Vec3 } from '../math/index.js';

/** Narrow the active scene camera to a PerspectiveCamera, or throw. */
function asPerspective(camera: THREE.Camera): THREE.PerspectiveCamera {
  if (!(camera instanceof THREE.PerspectiveCamera)) {
    throw new Error(
      'game-kit/r3f camera hooks require a PerspectiveCamera; the active <Canvas/> camera is not one.',
    );
  }
  return camera;
}

/**
 * Drive a third-person orbit-follow camera over the active scene camera.
 *
 * `getTarget` returns the current follow point each frame; `getInput` returns
 * the frame's {@link CameraInput} (drag / zoom). Returns the underlying
 * {@link OrbitCamera} for imperative calls (setAngles / dolly).
 */
export function useOrbitCamera(
  getTarget: () => Vec3,
  getInput?: () => CameraInput,
  opts?: OrbitCameraOptions,
): OrbitCamera {
  const camera = useThree((s) => s.camera);
  const controller = useMemo(
    () => createOrbitCamera(asPerspective(camera), opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [camera],
  );
  useFrame(() => {
    controller.update(getTarget(), getInput?.());
  });
  return controller;
}

/**
 * Drive a third-person chase camera (auto-yaws behind the target) over the
 * active scene camera. `getHeading` returns the direction the target faces each
 * frame. Returns the underlying {@link ChaseCamera}.
 */
export function useChaseCamera(
  getTarget: () => Vec3,
  getHeading: () => number,
  getInput?: () => CameraInput,
  opts?: ChaseCameraOptions,
): ChaseCamera {
  const camera = useThree((s) => s.camera);
  const controller = useMemo(
    () => createChaseCamera(asPerspective(camera), opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [camera],
  );
  useFrame(() => {
    controller.update(getTarget(), getHeading(), getInput?.());
  });
  return controller;
}

/**
 * Drive a first-person camera over the active scene camera. `getInput` returns
 * the frame's {@link CameraInput} (look delta + move axes); the hook feeds the
 * real per-frame `dt` from `useFrame`. Returns the underlying
 * {@link FirstPersonCamera} for imperative calls (setPosition).
 */
export function useFirstPersonCamera(
  getInput: () => CameraInput,
  opts?: FirstPersonCameraOptions,
): FirstPersonCamera {
  const camera = useThree((s) => s.camera);
  const controller = useMemo(
    () => createFirstPersonCamera(asPerspective(camera), opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [camera],
  );
  useFrame((_, dt) => {
    controller.update(dt, getInput());
  });
  return controller;
}
