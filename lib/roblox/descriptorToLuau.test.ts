import { describe, expect, it } from "vitest";
import { descriptorToLuau } from "./descriptorToLuau";
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

describe("descriptorToLuau", () => {
  it("emits one Part per socket plus a root part", () => {
    const lua = descriptorToLuau(DESCRIPTOR, SCHEMA);
    const matches = lua.match(/Instance\.new\("Part"\)/g) ?? [];
    // 2 sockets + 1 root.
    expect(matches).toHaveLength(3);
  });

  it("includes the descriptor id and archetype in the header + model name", () => {
    const lua = descriptorToLuau(DESCRIPTOR, SCHEMA);
    expect(lua).toContain("test-biped");
    expect(lua).toContain("BIPED");
    expect(lua).toContain('model.Name = "test-biped"');
  });

  it("converts the hex color to a Color3.fromRGB call", () => {
    const lua = descriptorToLuau(DESCRIPTOR, SCHEMA);
    // #C83232 → (200, 50, 50)
    expect(lua).toContain("Color3.fromRGB(200, 50, 50)");
  });

  it("expands a #rgb shorthand hex", () => {
    const lua = descriptorToLuau({ ...DESCRIPTOR, color: "#0f8" }, SCHEMA);
    // #0f8 → 00 ff 88 → (0, 255, 136)
    expect(lua).toContain("Color3.fromRGB(0, 255, 136)");
  });

  it("emits a Size line with the socket's stud numbers (no metre conversion)", () => {
    const lua = descriptorToLuau(DESCRIPTOR, SCHEMA);
    // Torso size [2, 1.5, 1] stays in studs.
    expect(lua).toContain("Vector3.new(2, 1.5, 1)");
    // Head size [1.2, 0.9, 1.6].
    expect(lua).toContain("Vector3.new(1.2, 0.9, 1.6)");
  });

  it("offsets each part from the root CFrame using studs", () => {
    const lua = descriptorToLuau(DESCRIPTOR, SCHEMA);
    // Head position [0, 2.4, 0.5].
    expect(lua).toContain("root.CFrame * CFrame.new(0, 2.4, 0.5)");
  });
});
