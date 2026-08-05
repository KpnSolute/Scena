import type { AssetSummary } from "../services/scena-api/assets";
import type { BoardScene, BoardSceneType } from "../services/scena-api/boards";

export type SignLayoutId = "full" | "split" | "sidebar_left" | "sidebar_right" | "hero_footer" | "grid_2x2";

export interface SceneZone {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  role: "primary" | "support" | "ticker";
}

export interface SignLayoutDefinition {
  id: SignLayoutId;
  label: string;
  description: string;
  zones: SceneZone[];
}

export const SIGN_LAYOUTS: readonly SignLayoutDefinition[] = [
  {
    id: "full",
    label: "Full canvas",
    description: "One flexible content area.",
    zones: [{ id: "main", label: "Main", x: 3, y: 3, width: 94, height: 94, role: "primary" }],
  },
  {
    id: "split",
    label: "Side by side",
    description: "Two equal content areas.",
    zones: [
      { id: "left", label: "Left", x: 3, y: 3, width: 45.5, height: 94, role: "primary" },
      { id: "right", label: "Right", x: 51.5, y: 3, width: 45.5, height: 94, role: "support" },
    ],
  },
  {
    id: "sidebar_left",
    label: "Left sidebar",
    description: "Supporting rail with a large main area.",
    zones: [
      { id: "rail", label: "Sidebar", x: 3, y: 3, width: 28, height: 94, role: "support" },
      { id: "main", label: "Main", x: 34, y: 3, width: 63, height: 94, role: "primary" },
    ],
  },
  {
    id: "sidebar_right",
    label: "Right sidebar",
    description: "Large main area with a supporting rail.",
    zones: [
      { id: "main", label: "Main", x: 3, y: 3, width: 63, height: 94, role: "primary" },
      { id: "rail", label: "Sidebar", x: 69, y: 3, width: 28, height: 94, role: "support" },
    ],
  },
  {
    id: "hero_footer",
    label: "Hero and ticker",
    description: "Large feature area with a lower information strip.",
    zones: [
      { id: "hero", label: "Hero", x: 3, y: 3, width: 94, height: 75, role: "primary" },
      { id: "footer", label: "Footer", x: 3, y: 81, width: 94, height: 16, role: "ticker" },
    ],
  },
  {
    id: "grid_2x2",
    label: "Four-up grid",
    description: "Four balanced content areas.",
    zones: [
      { id: "top_left", label: "Top left", x: 3, y: 3, width: 45.5, height: 45.5, role: "primary" },
      { id: "top_right", label: "Top right", x: 51.5, y: 3, width: 45.5, height: 45.5, role: "support" },
      { id: "bottom_left", label: "Bottom left", x: 3, y: 51.5, width: 45.5, height: 45.5, role: "support" },
      { id: "bottom_right", label: "Bottom right", x: 51.5, y: 51.5, width: 45.5, height: 45.5, role: "support" },
    ],
  },
] as const;

export function sceneTypeOf(scene: Pick<BoardScene, "scene_type">): BoardSceneType {
  return scene.scene_type === "sign" || scene.scene_type === "presentation" ? scene.scene_type : "canvas";
}

export function signLayoutOf(scene: Pick<BoardScene, "config">): SignLayoutDefinition {
  const id = typeof scene.config.layout === "string" ? scene.config.layout : "split";
  return SIGN_LAYOUTS.find((layout) => layout.id === id) ?? SIGN_LAYOUTS[1];
}

export function createBoardScene(
  type: BoardSceneType,
  order: number,
  options: { asset?: AssetSummary; name?: string } = {},
): BoardScene {
  const base: BoardScene = {
    id: crypto.randomUUID(),
    name: options.name ?? `${type === "canvas" ? "Canvas" : type === "sign" ? "Sign" : "Presentation"} ${order + 1}`,
    scene_type: type,
    config: {},
    sort_order: order,
    duration_ms: 10_000,
    transition_type: "fade",
    transition_config: {},
    background: { type: "color", value: "#000000" },
    is_hidden: false,
    elements: [],
  };

  if (type === "sign") {
    return { ...base, config: { layout: "split", snap_to_zones: true } };
  }
  if (type === "presentation" && options.asset) {
    const pages = Math.max(1, options.asset.page_count ?? 1);
    const slideDurationMs = 8_000;
    return {
      ...base,
      name: options.name ?? options.asset.original_filename.replace(/\.(pptx?|pdf)$/i, ""),
      duration_ms: pages * slideDurationMs,
      config: {
        asset_id: options.asset.id,
        page_count: pages,
        slide_duration_ms: slideDurationMs,
        fit: "contain",
        loop: false,
      },
    };
  }
  return base;
}

export function applySignLayout(scene: BoardScene, layoutId: SignLayoutId): BoardScene {
  const layout = SIGN_LAYOUTS.find((item) => item.id === layoutId) ?? SIGN_LAYOUTS[0];
  const zonesById = new Map(layout.zones.map((zone) => [zone.id, zone]));
  return {
    ...scene,
    scene_type: "sign",
    config: { ...scene.config, layout: layout.id, snap_to_zones: true },
    elements: scene.elements.map((element) => {
      const zoneId = typeof element.config.zone_id === "string" ? element.config.zone_id : "";
      const zone = zonesById.get(zoneId);
      return zone ? { ...element, x: zone.x, y: zone.y, width: zone.width, height: zone.height } : element;
    }),
  };
}

export function placementForNewElement(scene: BoardScene): Pick<SceneZone, "id" | "x" | "y" | "width" | "height"> | null {
  if (sceneTypeOf(scene) !== "sign") return null;
  const layout = signLayoutOf(scene);
  const occupied = new Set(scene.elements.map((element) => element.config.zone_id).filter((value): value is string => typeof value === "string"));
  const zone = layout.zones.find((item) => !occupied.has(item.id)) ?? layout.zones[0];
  return zone ? { id: zone.id, x: zone.x, y: zone.y, width: zone.width, height: zone.height } : null;
}
