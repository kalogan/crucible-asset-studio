import { describe, expect, it } from "vitest";
import { BoxGeometry, Mesh } from "three";
import { buildDescriptor } from "./descriptorToThree";
import { STUDS_TO_M } from "./convert";
import type { RobloxDescriptor, SocketSchema } from "./schema";

const SCHEMA: SocketSchema = {
  Torso: { position: [0, 0, 0], size: [2, 1.5, 1] },
  Head: { position: [0, 2.4, 0.5], size: [1.2, 0.9, 1.6] },
};

const DESCRIPTOR: RobloxDescriptor = {
  id: "test-biped",
  archetype: "BIPED",
  color: "#C83232",
  scale: 1,
};

describe("buildDescriptor", () => {
  it("emits one mesh per socket", () => {
    const group = buildDescriptor(DESCRIPTOR, SCHEMA);
    const meshes = group.children.filter((c): c is Mesh => c instanceof Mesh);
    expect(meshes).toHaveLength(2);
  });

  it("positions each mesh at its socket's studs→m position", () => {
    const group = buildDescriptor(DESCRIPTOR, SCHEMA);

    const torso = group.children.find((c) => c.name === "Torso");
    const head = group.children.find((c) => c.name === "Head");
    expect(torso).toBeDefined();
    expect(head).toBeDefined();

    // Torso at origin → stays at origin.
    expect(torso!.position.x).toBeCloseTo(0);
    expect(torso!.position.y).toBeCloseTo(0);
    expect(torso!.position.z).toBeCloseTo(0);

    // Head [0, 2.4, 0.5] studs → metres.
    expect(head!.position.x).toBeCloseTo(0);
    expect(head!.position.y).toBeCloseTo(2.4 * STUDS_TO_M);
    expect(head!.position.z).toBeCloseTo(0.5 * STUDS_TO_M);
  });

  it("gives a 'head' socket a non-box (rounded) geometry", () => {
    const group = buildDescriptor(DESCRIPTOR, SCHEMA);

    const torso = group.children.find((c): c is Mesh => c.name === "Torso");
    const head = group.children.find((c): c is Mesh => c.name === "Head");
    expect(torso).toBeDefined();
    expect(head).toBeDefined();

    // Torso stays a box; head rounds off (not a BoxGeometry).
    expect(torso!.geometry).toBeInstanceOf(BoxGeometry);
    expect(head!.geometry).not.toBeInstanceOf(BoxGeometry);
  });

  it("applies scale as a uniform multiplier on the group", () => {
    const group = buildDescriptor({ ...DESCRIPTOR, scale: 1.5 }, SCHEMA);
    expect(group.scale.x).toBeCloseTo(1.5);
    expect(group.scale.y).toBeCloseTo(1.5);
    expect(group.scale.z).toBeCloseTo(1.5);
  });
});
