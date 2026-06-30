"use client";

import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { buildWorld, type WorldDescriptor } from "game-kit";

/** Apply sky background + fog from the descriptor's environment. */
function SceneEnv({ env }: { env: WorldDescriptor["environment"] }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color(env.skyColor);
    scene.fog =
      env.fogDensity > 0
        ? new THREE.FogExp2(new THREE.Color(env.fogColor).getHex(), env.fogDensity)
        : null;
    return () => {
      scene.fog = null;
    };
  }, [scene, env.skyColor, env.fogColor, env.fogDensity]);
  return null;
}

/** Rebuild the world group when the descriptor changes; dispose the previous one. */
function World({ descriptor }: { descriptor: WorldDescriptor }) {
  const group = useMemo(() => buildWorld(descriptor), [descriptor]);
  useEffect(() => {
    return () => {
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose?.();
      });
    };
  }, [group]);
  return <primitive object={group} />;
}

export function WorldView({ descriptor }: { descriptor: WorldDescriptor }) {
  const env = descriptor.environment;
  const ambient = new THREE.Color(env.ambientTint);
  const zone = descriptor.terrain.zoneSize;
  return (
    <Canvas shadows camera={{ position: [zone * 0.6, zone * 0.5, zone * 0.6], fov: 50 }}>
      <SceneEnv env={env} />
      <hemisphereLight args={[ambient.getHex(), 0x404048, 0.9]} />
      <directionalLight
        position={[zone * 0.5, zone * 0.8, zone * 0.3]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <World descriptor={descriptor} />
      <OrbitControls target={[0, 0, 0]} enableDamping />
    </Canvas>
  );
}
