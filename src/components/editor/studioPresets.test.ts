import { describe, expect, it } from "vitest";
import { applyBrandPreset, BRAND_PRESETS, createSceneFromTemplate, STUDIO_TEMPLATES } from "./studioPresets";

describe("Studio presets", () => {
  it.each(STUDIO_TEMPLATES)("creates a persisted scene for $name", (template) => {
    const scene = createSceneFromTemplate(template.id, 2);
    expect(scene.sort_order).toBe(2);
    expect(scene.elements.length).toBeGreaterThan(4);
    expect(scene.elements.every((element) => element.id && element.config)).toBe(true);
  });
  it("applies brand tokens to text and shapes", () => {
    const scene = createSceneFromTemplate("cafe-classic", 0);
    const patch = applyBrandPreset(scene, BRAND_PRESETS[1]);
    expect(patch.background).toEqual({ type: "color", value: BRAND_PRESETS[1].background });
    expect(patch.elements?.some((element) => element.config.font_family === BRAND_PRESETS[1].font)).toBe(true);
  });
});
