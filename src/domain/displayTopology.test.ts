import { describe, expect, it } from "vitest";
import { clampViewport, topologyPreset } from "./displayTopology";

describe("display topology", () => {
  it("creates a contiguous horizontal task view", () => {
    const viewports = topologyPreset(3, "horizontal");
    expect(viewports).toHaveLength(3);
    expect(viewports[0].y).toBe(viewports[2].y);
    expect(viewports[0].x).toBeLessThan(viewports[1].x);
  });

  it("clamps dragged displays inside the control surface", () => {
    expect(clampViewport({ x: 95, y: -4, width: 40, height: 30 })).toEqual({ x: 60, y: 0, width: 40, height: 30 });
  });
});
