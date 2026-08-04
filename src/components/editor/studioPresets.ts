import type { BoardScene, SceneElement } from "../../services/scena-api/boards";

export type StudioTemplateId = "cafe-classic" | "daily-special" | "split-menu";
export interface StudioTemplate { id: StudioTemplateId; name: string; description: string; colors: [string, string]; }
export interface BrandPreset { id: string; name: string; background: string; surface: string; accent: string; text: string; font: "body" | "display"; }

export const STUDIO_TEMPLATES: readonly StudioTemplate[] = [
  { id: "cafe-classic", name: "Cafe classic", description: "Title, two menu sections, items, and prices", colors: ["#111827", "#f59e0b"] },
  { id: "daily-special", name: "Daily special", description: "Bold feature item with a guest QR code", colors: ["#3b172f", "#f472b6"] },
  { id: "split-menu", name: "Split menu", description: "Two-column food and drinks layout", colors: ["#0f172a", "#38bdf8"] },
];

export const BRAND_PRESETS: readonly BrandPreset[] = [
  { id: "midnight", name: "Midnight cafe", background: "#0b1020", surface: "#172033", accent: "#f59e0b", text: "#f8fafc", font: "display" },
  { id: "espresso", name: "Espresso house", background: "#24170f", surface: "#3b271a", accent: "#f4c27a", text: "#fff7ed", font: "display" },
  { id: "fresh", name: "Fresh counter", background: "#052e2b", surface: "#134e4a", accent: "#5eead4", text: "#f0fdfa", font: "body" },
];

function text(id: string, value: string, x: number, y: number, width: number, height: number, size: number, weight = 600, align: "left" | "center" | "right" = "left"): SceneElement {
  return { id, element_type: "text", render_mode: "static", name: null, x, y, width, height, rotation: 0, opacity: 1, z_index: 2, is_locked: false, is_visible: true, asset_id: null, asset_page_id: null, config: { text: value, font_size: size, font_weight: weight, font_family: "display", color: "#f8fafc", align } };
}

function shape(id: string, x: number, y: number, width: number, height: number, fill: string): SceneElement {
  return { id, element_type: "shape", render_mode: "static", name: null, x, y, width, height, rotation: 0, opacity: 1, z_index: 0, is_locked: false, is_visible: true, asset_id: null, asset_page_id: null, config: { variant: "rectangle", fill, fill_opacity: 1, corner_radius: 2, border_width: 0 } };
}

export function createSceneFromTemplate(templateId: StudioTemplateId, index: number): BoardScene {
  const id = crypto.randomUUID();
  const uid = () => crypto.randomUUID();
  let elements: SceneElement[];
  let background = "#0b1020";
  if (templateId === "daily-special") {
    background = "#3b172f";
    elements = [shape(uid(), 5, 8, 90, 84, "#5b2147"), text(uid(), "TODAY’S SPECIAL", 10, 14, 80, 12, 62, 800, "center"), text(uid(), "Cafe favorite", 14, 38, 52, 10, 42, 700), text(uid(), "A short description of today’s featured dish", 14, 51, 52, 14, 26), text(uid(), "$0.00", 66, 40, 20, 12, 40, 800, "right")];
  } else if (templateId === "split-menu") {
    background = "#0f172a";
    elements = [text(uid(), "MENU", 7, 7, 86, 12, 68, 800, "center"), shape(uid(), 49, 24, 0.5, 66, "#38bdf8"), text(uid(), "FOOD", 8, 25, 38, 9, 36, 800), text(uid(), "Menu item ........ $0.00\nMenu item ........ $0.00\nMenu item ........ $0.00", 8, 39, 38, 38, 26), text(uid(), "DRINKS", 54, 25, 38, 9, 36, 800), text(uid(), "Drink ............ $0.00\nDrink ............ $0.00\nDrink ............ $0.00", 54, 39, 38, 38, 26)];
  } else {
    elements = [text(uid(), "TODAY’S MENU", 8, 7, 84, 12, 68, 800, "center"), shape(uid(), 8, 23, 84, 1, "#f59e0b"), text(uid(), "BREAKFAST", 9, 29, 37, 8, 34, 800), text(uid(), "Menu item ........ $0.00\nMenu item ........ $0.00\nMenu item ........ $0.00", 9, 41, 37, 36, 25), text(uid(), "LUNCH", 54, 29, 37, 8, 34, 800), text(uid(), "Menu item ........ $0.00\nMenu item ........ $0.00\nMenu item ........ $0.00", 54, 41, 37, 36, 25)];
  }
  return { id, name: STUDIO_TEMPLATES.find((item) => item.id === templateId)?.name ?? `Scene ${index + 1}`, sort_order: index, duration_ms: 10_000, transition_type: "fade", transition_config: {}, background: { type: "color", value: background }, is_hidden: false, elements };
}

export function applyBrandPreset(scene: BoardScene, brand: BrandPreset): Partial<BoardScene> {
  return {
    background: { type: "color", value: brand.background },
    elements: scene.elements.map((element) => {
      const config = { ...element.config };
      if (element.element_type === "text" || ["clock", "date", "countdown", "ticker", "data_text"].includes(element.element_type)) Object.assign(config, { color: brand.text, font_family: brand.font });
      if (element.element_type === "shape") Object.assign(config, { fill: brand.surface, border_color: brand.accent });
      return { ...element, config };
    }),
  };
}
