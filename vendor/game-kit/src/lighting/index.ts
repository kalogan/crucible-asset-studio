/**
 * Lighting rig — vanilla three.
 *
 * Adds a sensible default three-point-ish rig to a scene: an ambient fill, a
 * shadow-casting "sun" (DirectionalLight), and optional cool fill + rim lights.
 *
 * Proven values are distilled from two shipped games:
 *   - project-mmo FrostpeaksZone: ambient ~0.45, sun with a 2048 shadow map,
 *     near 1 / far 120, ortho frustum ±60.
 *   - storm-break-hockey ThreeSetup: PCFSoftShadowMap, warm key + cool rim.
 *
 * An r3f variant lives in ./r3f.tsx (a <LightingRig/> component). It consumes
 * the shared LIGHTING_DEFAULTS below so vanilla + r3f never drift.
 */

import * as THREE from 'three';

/**
 * Default values for the lighting rig, shared between the vanilla
 * `createLightingRig` and the r3f `<LightingRig/>` so the two never drift.
 */
export const LIGHTING_DEFAULTS = {
  ambient: {
    color: 0xffffff as THREE.ColorRepresentation,
    intensity: 0.4,
  },
  sun: {
    color: 0xfff1d6 as THREE.ColorRepresentation, // warm daylight
    intensity: 0.85,
    position: [40, 60, 30] as [number, number, number],
    castShadow: true,
    shadowMapSize: 2048,
    shadowCameraExtent: 60,
    shadowCameraNear: 1,
    shadowCameraFar: 120,
  },
  fill: {
    color: 0xaec6ff as THREE.ColorRepresentation, // cool sky
    intensity: 0.45,
    position: [-40, 30, 20] as [number, number, number],
  },
  rim: {
    color: 0x2244aa as THREE.ColorRepresentation, // cool back rim
    intensity: 0.55,
    position: [-50, 12, -50] as [number, number, number],
  },
} as const;

export interface LightingRigConfig {
  /** Ambient hemispheric fill. */
  ambient?: {
    color?: THREE.ColorRepresentation;
    intensity?: number;
  };
  /** Primary shadow-casting directional "sun". */
  sun?: {
    color?: THREE.ColorRepresentation;
    intensity?: number;
    position?: [number, number, number];
    castShadow?: boolean;
    shadowMapSize?: number;
    /** Half-extent of the orthographic shadow camera frustum. */
    shadowCameraExtent?: number;
    shadowCameraNear?: number;
    shadowCameraFar?: number;
  };
  /** Optional cool fill light opposite the sun. Enabled by default. */
  fill?:
    | false
    | {
        color?: THREE.ColorRepresentation;
        intensity?: number;
        position?: [number, number, number];
      };
  /** Optional cool rim/back light. Enabled by default. */
  rim?:
    | false
    | {
        color?: THREE.ColorRepresentation;
        intensity?: number;
        position?: [number, number, number];
      };
}

export interface LightingRig {
  ambient: THREE.AmbientLight;
  sun: THREE.DirectionalLight;
  fill?: THREE.DirectionalLight;
  rim?: THREE.DirectionalLight;
}

/**
 * Build and attach a lighting rig to `scene`. Returns the created lights so the
 * caller can tweak/animate them. For soft shadows, set the renderer's
 * shadowMap.type to THREE.PCFSoftShadowMap.
 */
export function createLightingRig(
  scene: THREE.Scene,
  config: LightingRigConfig = {},
): LightingRig {
  // ── Ambient fill (~0.4) ────────────────────────────────────────────────────
  const ambient = new THREE.AmbientLight(
    config.ambient?.color ?? LIGHTING_DEFAULTS.ambient.color,
    config.ambient?.intensity ?? LIGHTING_DEFAULTS.ambient.intensity,
  );
  scene.add(ambient);

  // ── Warm shadow-casting sun (~0.85) ────────────────────────────────────────
  const sunCfg = config.sun ?? {};
  const sun = new THREE.DirectionalLight(
    sunCfg.color ?? LIGHTING_DEFAULTS.sun.color, // warm daylight
    sunCfg.intensity ?? LIGHTING_DEFAULTS.sun.intensity,
  );
  const sunPos = sunCfg.position ?? LIGHTING_DEFAULTS.sun.position;
  sun.position.set(sunPos[0], sunPos[1], sunPos[2]);
  sun.castShadow = sunCfg.castShadow ?? LIGHTING_DEFAULTS.sun.castShadow;

  const mapSize = sunCfg.shadowMapSize ?? LIGHTING_DEFAULTS.sun.shadowMapSize;
  sun.shadow.mapSize.set(mapSize, mapSize);
  sun.shadow.camera.near = sunCfg.shadowCameraNear ?? LIGHTING_DEFAULTS.sun.shadowCameraNear;
  sun.shadow.camera.far = sunCfg.shadowCameraFar ?? LIGHTING_DEFAULTS.sun.shadowCameraFar;
  const extent = sunCfg.shadowCameraExtent ?? LIGHTING_DEFAULTS.sun.shadowCameraExtent;
  sun.shadow.camera.left = -extent;
  sun.shadow.camera.right = extent;
  sun.shadow.camera.top = extent;
  sun.shadow.camera.bottom = -extent;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);
  scene.add(sun.target);

  const rig: LightingRig = { ambient, sun };

  // ── Cool fill (~0.45), opposite-ish the sun ────────────────────────────────
  if (config.fill !== false) {
    const fillCfg = config.fill ?? {};
    const fill = new THREE.DirectionalLight(
      fillCfg.color ?? LIGHTING_DEFAULTS.fill.color, // cool sky
      fillCfg.intensity ?? LIGHTING_DEFAULTS.fill.intensity,
    );
    const fillPos = fillCfg.position ?? LIGHTING_DEFAULTS.fill.position;
    fill.position.set(fillPos[0], fillPos[1], fillPos[2]);
    scene.add(fill);
    rig.fill = fill;
  }

  // ── Cool rim/back light ────────────────────────────────────────────────────
  if (config.rim !== false) {
    const rimCfg = config.rim ?? {};
    const rim = new THREE.DirectionalLight(
      rimCfg.color ?? LIGHTING_DEFAULTS.rim.color, // cool back rim
      rimCfg.intensity ?? LIGHTING_DEFAULTS.rim.intensity,
    );
    const rimPos = rimCfg.position ?? LIGHTING_DEFAULTS.rim.position;
    rim.position.set(rimPos[0], rimPos[1], rimPos[2]);
    scene.add(rim);
    rig.rim = rim;
  }

  return rig;
}
