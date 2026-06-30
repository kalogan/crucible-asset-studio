"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  buildWorld,
  createGridNav,
  createNpcBehavior,
  createRng,
  sampleHeight,
  type WorldDescriptor,
} from "game-kit";

function SceneEnv({ env }: { env: WorldDescriptor["environment"] }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color(env.skyColor);
    scene.fog = new THREE.FogExp2(new THREE.Color(env.fogColor).getHex(), env.fogDensity);
    return () => {
      scene.fog = null;
    };
  }, [scene, env.skyColor, env.fogColor, env.fogDensity]);
  return null;
}

function WorldMesh({ descriptor }: { descriptor: WorldDescriptor }) {
  const group = useMemo(() => buildWorld(descriptor), [descriptor]);
  return <primitive object={group} />;
}

/** An NPC that wanders the world via game-kit nav + behavior; click it to talk. */
function NpcAgent({
  descriptor,
  onTalk,
}: {
  descriptor: WorldDescriptor;
  onTalk: () => void;
}) {
  const ref = useRef<THREE.Group>(null);

  const behavior = useMemo(() => {
    const zone = descriptor.terrain.zoneSize;
    const n = 24;
    const cell = zone / n;
    const nav = createGridNav({
      width: n,
      height: n,
      cellSize: cell,
      origin: [-zone / 2 + cell / 2, -zone / 2 + cell / 2],
      isWalkable: () => true,
    });
    return createNpcBehavior({
      pathfinder: nav,
      bounds: { kind: "wander", anchor: [0, 0], radius: zone * 0.25 },
      rng: createRng(7),
      start: [0, 0],
      speed: 3,
    });
  }, [descriptor]);

  useFrame((_, dt) => {
    const s = behavior.tick(Math.min(dt, 0.1));
    const g = ref.current;
    if (g) {
      const y = sampleHeight(descriptor.terrain, s.position[0], s.position[1]);
      g.position.set(s.position[0], y, s.position[1]);
    }
  });

  return (
    <group
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        onTalk();
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "default")}
    >
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.4, 0.9, 4, 8]} />
        <meshStandardMaterial color="#2f5d4a" flatShading />
      </mesh>
      <mesh position={[0, 1.9, 0]} castShadow>
        <sphereGeometry args={[0.32, 12, 12]} />
        <meshStandardMaterial color="#e8c39a" flatShading />
      </mesh>
      {/* a soft ring so it reads as interactive */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.9, 0.05, 8, 24]} />
        <meshStandardMaterial color="#7fffd4" emissive="#2fa074" toneMapped={false} />
      </mesh>
    </group>
  );
}

export function SampleScene({
  descriptor,
  onTalk,
}: {
  descriptor: WorldDescriptor;
  onTalk: () => void;
}) {
  const zone = descriptor.terrain.zoneSize;
  return (
    <Canvas shadows camera={{ position: [zone * 0.4, zone * 0.45, zone * 0.4], fov: 50 }}>
      <SceneEnv env={descriptor.environment} />
      <hemisphereLight args={[0xffffff, 0x404048, 0.9]} />
      <directionalLight
        position={[zone * 0.5, zone * 0.8, zone * 0.3]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <WorldMesh descriptor={descriptor} />
      <NpcAgent descriptor={descriptor} onTalk={onTalk} />
      <OrbitControls target={[0, 0, 0]} enableDamping makeDefault />
    </Canvas>
  );
}
