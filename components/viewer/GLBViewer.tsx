"use client";

import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Center, OrbitControls, useGLTF } from "@react-three/drei";

/**
 * GLB review viewer (S4). Self-contained lighting (no external HDR fetch), so it
 * works offline and stays on the cozy faceted look (ART_SPEC: flat/ambient, no PBR
 * environment). Accessible: labeled region + a keyboard-reachable Download link as
 * the non-visual alternative; honors prefers-reduced-motion (no auto-rotate/damping).
 */

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

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

class ModelErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export interface GLBViewerProps {
  url: string | null;
  label?: string;
  className?: string;
}

export function GLBViewer({
  url,
  label = "3D asset preview",
  className,
}: GLBViewerProps) {
  const reduced = useReducedMotion();
  const [loadFailed, setLoadFailed] = useState(false);

  const frame =
    "relative aspect-square w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900";

  if (!url) {
    return (
      <div
        role="img"
        aria-label="No 3D model to preview yet"
        className={`${frame} flex items-center justify-center ${className ?? ""}`}
      >
        <p className="text-sm text-zinc-400">No model yet</p>
      </div>
    );
  }

  return (
    <figure className={`flex flex-col gap-2 ${className ?? ""}`}>
      <div role="img" aria-label={label} className={frame}>
        {loadFailed ? (
          <div className="flex h-full items-center justify-center">
            <p className="px-4 text-center text-sm text-rose-300">
              Could not load this model.
            </p>
          </div>
        ) : (
          <Canvas camera={{ position: [2.5, 2, 2.5], fov: 45 }} dpr={[1, 2]}>
            <color attach="background" args={["#18181b"]} />
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 8, 5]} intensity={1.3} />
            <directionalLight position={[-5, 2, -3]} intensity={0.4} />
            <Suspense fallback={null}>
              <ModelErrorBoundary onError={() => setLoadFailed(true)}>
                <Center>
                  <Model url={url} />
                </Center>
              </ModelErrorBoundary>
            </Suspense>
            <OrbitControls
              makeDefault
              enablePan
              enableDamping={!reduced}
              autoRotate={false}
            />
          </Canvas>
        )}
      </div>
      <figcaption className="flex items-center justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <a
          href={url}
          download
          className="rounded text-amber-300 underline underline-offset-2 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          Download GLB
        </a>
      </figcaption>
    </figure>
  );
}
