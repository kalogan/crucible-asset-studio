/**
 * Lighting rig — react-three-fiber variant.
 *
 * A declarative <LightingRig/> emitting the same lights as the vanilla
 * `createLightingRig`: an ambient fill, a shadow-casting warm "sun", and
 * optional cool fill + rim lights. Default values come from the shared
 * LIGHTING_DEFAULTS in ./index.ts so vanilla + r3f never drift.
 *
 * Requires the react + @react-three/fiber peer deps (optional in package.json).
 */

import type { JSX } from 'react';
import type * as THREE from 'three';
import { LIGHTING_DEFAULTS } from './index.js';

export interface LightingRigProps {
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

/**
 * Declarative lighting rig for r3f. Drop into a <Canvas/> scene. For soft
 * shadows, set the canvas's `shadows` prop (and a soft shadow map type).
 */
export function LightingRig(props: LightingRigProps = {}): JSX.Element {
  const sun = props.sun ?? {};
  const extent = sun.shadowCameraExtent ?? LIGHTING_DEFAULTS.sun.shadowCameraExtent;
  const mapSize = sun.shadowMapSize ?? LIGHTING_DEFAULTS.sun.shadowMapSize;
  const sunPos = sun.position ?? LIGHTING_DEFAULTS.sun.position;

  const fill = props.fill === false ? null : props.fill ?? {};
  const rim = props.rim === false ? null : props.rim ?? {};

  return (
    <>
      <ambientLight
        color={props.ambient?.color ?? LIGHTING_DEFAULTS.ambient.color}
        intensity={props.ambient?.intensity ?? LIGHTING_DEFAULTS.ambient.intensity}
      />

      <directionalLight
        color={sun.color ?? LIGHTING_DEFAULTS.sun.color}
        intensity={sun.intensity ?? LIGHTING_DEFAULTS.sun.intensity}
        position={sunPos}
        castShadow={sun.castShadow ?? LIGHTING_DEFAULTS.sun.castShadow}
        shadow-mapSize-width={mapSize}
        shadow-mapSize-height={mapSize}
        shadow-camera-near={sun.shadowCameraNear ?? LIGHTING_DEFAULTS.sun.shadowCameraNear}
        shadow-camera-far={sun.shadowCameraFar ?? LIGHTING_DEFAULTS.sun.shadowCameraFar}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
      />

      {fill && (
        <directionalLight
          color={fill.color ?? LIGHTING_DEFAULTS.fill.color}
          intensity={fill.intensity ?? LIGHTING_DEFAULTS.fill.intensity}
          position={fill.position ?? LIGHTING_DEFAULTS.fill.position}
        />
      )}

      {rim && (
        <directionalLight
          color={rim.color ?? LIGHTING_DEFAULTS.rim.color}
          intensity={rim.intensity ?? LIGHTING_DEFAULTS.rim.intensity}
          position={rim.position ?? LIGHTING_DEFAULTS.rim.position}
        />
      )}
    </>
  );
}
