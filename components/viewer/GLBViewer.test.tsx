import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { GLBViewer } from "./GLBViewer";

// matchMedia is not implemented in jsdom — provide a minimal stub for the hook.
if (!window.matchMedia) {
  // @ts-expect-error test stub
  window.matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

afterEach(cleanup);

describe("GLBViewer (empty state — no WebGL needed)", () => {
  it("renders an accessible placeholder when there is no url", () => {
    render(<GLBViewer url={null} />);
    expect(screen.getByRole("img", { name: /no 3d model/i })).toBeInTheDocument();
    expect(screen.getByText(/no model yet/i)).toBeInTheDocument();
  });
});
