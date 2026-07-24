import { describe, expect, it } from "vitest";
import { normalizeElementConfig } from "./PropertiesPanel";

describe("normalizeElementConfig", () => {
  it("provides useful defaults for every configurable element", () => {
    expect(normalizeElementConfig("clock", undefined)).toEqual({ time_format: "12h", show_seconds: false, timezone: "" });
    expect(normalizeElementConfig("ticker", undefined)).toEqual({ text: "Scrolling announcement", duration_s: 20, direction: "left", paused: false });
    expect(normalizeElementConfig("video", undefined)).toEqual({ autoplay: true, muted: true, loop: true });
  });

  it("preserves saved values while filling missing fields", () => {
    expect(normalizeElementConfig("weather", { location: "New York", units: "celsius" })).toEqual({
      location: "New York", units: "celsius", show_condition: true,
    });
  });

  it("does not mutate the supplied config", () => {
    const config = { target: "2026-07-24T09:00" };
    normalizeElementConfig("countdown", config).units = "hms";
    expect(config).toEqual({ target: "2026-07-24T09:00" });
  });
});
