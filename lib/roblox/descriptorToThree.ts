import {
  Group,
  Mesh,
  MeshStandardMaterial,
} from "three";
import type { RobloxDescriptor, SocketSchema } from "./schema";
import { vec3ToM } from "./convert";
import { socketGeometry } from "./partShape";

/**
 * Build a greybox three.js Group from an engine-agnostic descriptor.
 *
 * For every socket in the archetype's `schema` we emit a `Mesh` whose geometry
 * is chosen by socket-name heuristic (see `socketGeometry`) — heads round off,
 * limbs become cylinders, tails taper — sized `size`-studs→m and positioned at
 * `position`-studs→m, all in the descriptor's greybox `color`. DNA part-loading
 * (swapping these primitives for real meshes per `descriptor.dna`) is future
 * work — this stage is greybox primitives only.
 *
 * Scale handling: `descriptor.scale` is a uniform *multiplier*, applied to
 * `group.scale` rather than baked into geometry. This keeps each part's
 * stud→metre mapping intact (so child positions read in true metres) and lets
 * the renderer's normalize-to-fit stage scale the whole assembly cleanly.
 *
 * Pure (three.js only) — no React / no DOM, so it's unit-testable.
 */
export function buildDescriptor(
  descriptor: RobloxDescriptor,
  schema: SocketSchema,
): Group {
  const group = new Group();
  group.name = descriptor.id;

  for (const [socketName, socket] of Object.entries(schema)) {
    const sizeM = vec3ToM(socket.size);
    const [px, py, pz] = vec3ToM(socket.position);

    const geometry = socketGeometry(socketName, sizeM);
    const material = new MeshStandardMaterial({ color: descriptor.color });
    const mesh = new Mesh(geometry, material);
    mesh.name = socketName;
    mesh.position.set(px, py, pz);

    group.add(mesh);
  }

  // Uniform multiplier on the whole assembly (see note above).
  group.scale.setScalar(descriptor.scale);

  return group;
}
