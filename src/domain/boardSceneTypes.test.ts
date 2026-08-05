import { describe, expect, it } from "vitest";
import { applySignLayout, createBoardScene, placementForNewElement, signLayoutOf } from "./boardSceneTypes";

describe("Board Scene types", () => {
  it("treats one uploaded deck as one timed presentation Scene", () => {
    const scene = createBoardScene("presentation", 0, { asset: {
      id: "a", workspace_id: "w", asset_kind: "powerpoint", original_filename: "Lunch deck.pptx",
      mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", source_size_bytes: 1,
      status: "ready", page_count: 4, metadata: {}, error_code: null, error_message_safe: null,
      source_uploaded_at: null, processed_at: null, created_at: "", updated_at: "",
    } });
    expect(scene.scene_type).toBe("presentation");
    expect(scene.config.asset_id).toBe("a");
    expect(scene.duration_ms).toBe(32_000);
    expect(scene.elements).toEqual([]);
  });

  it("provides distinct sign zones and places new content into an open zone", () => {
    const scene = createBoardScene("sign", 0);
    expect(signLayoutOf(scene).zones).toHaveLength(2);
    expect(placementForNewElement(scene)?.id).toBe("left");
  });

  it("reflows zone-bound content when the sign layout changes", () => {
    const scene = createBoardScene("sign", 0);
    scene.elements = [{
      id: "e", element_type: "text", render_mode: "static", name: null,
      x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1, z_index: 0,
      is_locked: false, is_visible: true, asset_id: null, asset_page_id: null,
      config: { text: "Menu", zone_id: "footer" },
    }];
    const next = applySignLayout(scene, "hero_footer");
    expect(next.elements[0]).toMatchObject({ x: 3, y: 81, width: 94, height: 16 });
  });
});
