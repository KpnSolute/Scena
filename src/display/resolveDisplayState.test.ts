import { describe, expect, it } from "vitest";
import { resolveDisplayState, type LayoutData, type SessionData, type SessionScreenData } from "./resolveDisplayState";

const NOW = "2026-07-20T12:00:00.000Z";
const now = () => NOW;

const layout: LayoutData = {
  id: "layout-1",
  name: "Front Counter",
  canvas_width: 1920,
  canvas_height: 1080,
  background_color: "#000000",
  tiles: [{ id: "tile-1", scene_id: "scene-1", x_percent: 0, y_percent: 0, width_percent: 100, height_percent: 100, z_index: 0, is_visible: true, config: {}, content: null }],
  updated_at: "2026-07-20T11:00:00.000Z",
};

function session(overrides: Partial<SessionData> = {}): SessionData {
  return { id: "session-1", name: "Lunch rush", status: "active", display_mode: "independent", shared_layout_id: null, updated_at: "2026-07-20T11:30:00.000Z", ...overrides };
}
function sessionScreen(overrides: Partial<SessionScreenData> = {}): SessionScreenData {
  return {
    id: "ss-1",
    board_id: null,
    is_enabled: true,
    is_primary: false,
    layout_id: "layout-1",
    rotation_degrees: 0,
    viewport_x_percent: 0,
    viewport_y_percent: 0,
    viewport_width_percent: 100,
    viewport_height_percent: 100,
    ...overrides,
  };
}
const layoutOf = (id: string) => (id === layout.id ? layout : null);

describe("resolveDisplayState", () => {
  it("returns standby with no_active_session when there is no session", () => {
    const result = resolveDisplayState("Screen A", null, null, layoutOf, now);
    expect(result).toEqual({ status: "standby", screen_name: "Screen A", reason: "no_active_session" });
  });

  it("returns standby when the session is draft, not active", () => {
    const result = resolveDisplayState("Screen A", session({ status: "draft" }), sessionScreen(), layoutOf, now);
    expect(result.status).toBe("standby");
  });

  it("returns standby with screen_disabled when the assignment is disabled", () => {
    const result = resolveDisplayState("Screen A", session(), sessionScreen({ is_enabled: false }), layoutOf, now);
    expect(result).toMatchObject({ status: "standby", reason: "screen_disabled" });
  });

  it("returns standby with no_layout when the referenced layout can't be found", () => {
    const result = resolveDisplayState("Screen A", session(), sessionScreen({ layout_id: "missing" }), layoutOf, now);
    expect(result).toMatchObject({ status: "standby", reason: "no_layout" });
  });

  it("independent mode uses the session-screen's own layout_id and a full viewport", () => {
    const result = resolveDisplayState("Screen A", session({ display_mode: "independent" }), sessionScreen(), layoutOf, now);
    expect(result.status).toBe("showing");
    if (result.status !== "showing") throw new Error("expected showing");
    expect(result.layout.id).toBe("layout-1");
    expect(result.viewport).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it("single mode behaves like independent for layout resolution", () => {
    const result = resolveDisplayState("Screen A", session({ display_mode: "single" }), sessionScreen(), layoutOf, now);
    expect(result.status).toBe("showing");
  });

  it("duplicate mode uses the session's shared_layout_id, ignoring the per-screen layout_id", () => {
    const result = resolveDisplayState(
      "Screen A",
      session({ display_mode: "duplicate", shared_layout_id: "layout-1" }),
      sessionScreen({ layout_id: "some-other-layout" }),
      layoutOf,
      now,
    );
    expect(result.status).toBe("showing");
    if (result.status !== "showing") throw new Error("expected showing");
    expect(result.layout.id).toBe("layout-1");
    expect(result.viewport).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it("extend mode crops to the session-screen's own viewport percentages", () => {
    const result = resolveDisplayState(
      "Screen A",
      session({ display_mode: "extend", shared_layout_id: "layout-1" }),
      sessionScreen({ viewport_x_percent: 50, viewport_y_percent: 0, viewport_width_percent: 50, viewport_height_percent: 100 }),
      layoutOf,
      now,
    );
    expect(result.status).toBe("showing");
    if (result.status !== "showing") throw new Error("expected showing");
    expect(result.viewport).toEqual({ x: 50, y: 0, width: 50, height: 100 });
  });

  it("produces a stable content_version that changes when the layout's updated_at changes", () => {
    const a = resolveDisplayState("Screen A", session(), sessionScreen(), layoutOf, now);
    const changedLayout: LayoutData = { ...layout, updated_at: "2026-07-20T13:00:00.000Z" };
    const b = resolveDisplayState("Screen A", session(), sessionScreen(), (id) => (id === "layout-1" ? changedLayout : null), now);
    if (a.status !== "showing" || b.status !== "showing") throw new Error("expected showing");
    expect(a.content_version).not.toBe(b.content_version);
  });
});
