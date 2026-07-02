/**
 * Cutscene — react-three-fiber shell.
 *
 * A thin `<CutscenePlayer/>` wrapping the vanilla `createCutscenePlayer`. Each
 * `useFrame` tick it steps the pure core and, while `active`, drives the
 * default scene camera's position + lookAt directly from the resolved frame.
 * Ramps and events are just forwarded to the consumer via callbacks — the
 * shell never touches fog, lights, or any other scene object itself, and it
 * renders nothing (no letterbox/caption DOM, no audio; the game owns those).
 *
 * Requires the react + @react-three/fiber peer deps (optional in package.json).
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  createCutscenePlayer,
  type CutsceneSequence,
  type CutsceneFrame,
  type CutsceneEvent,
} from './index.js';

/** Props for {@link CutscenePlayer}. */
export interface CutscenePlayerProps {
  /** The authored sequence to play. */
  sequence: CutsceneSequence;
  /** Called every step with the resolved frame (camera + ramps + events). */
  onFrame?: (frame: CutsceneFrame) => void;
  /** Called once per event, in order, as each fires. */
  onEvent?: (event: CutsceneEvent) => void;
  /** Called once when the sequence finishes. */
  onDone?: () => void;
  /** While true, the player steps and drives the scene camera. Default true. */
  active?: boolean;
}

/**
 * Drive an authored {@link CutsceneSequence}. Drop `<CutscenePlayer sequence=.../>`
 * inside a `<Canvas>`:
 *
 * ```tsx
 * <CutscenePlayer
 *   sequence={endingMontage}
 *   onFrame={(f) => applyRamps(f.ramps)} // game maps ramps onto fog/lights
 *   onEvent={(e) => { if (e.name === 'clip') playClip(e.data); }}
 *   onDone={() => setScene('creditsRoll')}
 * />
 * ```
 *
 * Renders nothing. While `active` (default true), each `useFrame` tick steps
 * the pure core and writes the resolved camera pose onto the active scene
 * camera. Ramps and events are forwarded as-is — the game decides what they mean.
 */
export function CutscenePlayer(props: CutscenePlayerProps): null {
  const { sequence, onFrame, onEvent, onDone, active = true } = props;
  const camera = useThree((s) => s.camera);

  const player = useMemo(
    () => createCutscenePlayer(sequence),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sequence],
  );

  // Keep the latest callbacks in refs so useFrame never restarts on rerender.
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const donePosted = useRef(false);

  // Reset the "done" latch if the sequence identity changes.
  useEffect(() => {
    donePosted.current = false;
  }, [sequence]);

  useFrame((_, dt) => {
    if (!active || donePosted.current) return;

    const frame = player.step(dt);

    if (active && frame.camera) {
      camera.position.set(frame.camera.pos[0], frame.camera.pos[1], frame.camera.pos[2]);
      camera.lookAt(frame.camera.lookAt[0], frame.camera.lookAt[1], frame.camera.lookAt[2]);
    }

    onFrameRef.current?.(frame);
    for (const event of frame.events) {
      onEventRef.current?.(event);
    }

    if (frame.done && !donePosted.current) {
      donePosted.current = true;
      onDoneRef.current?.();
    }
  });

  return null;
}
