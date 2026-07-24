// Shared prop contract for every element renderer in the registry
// (see ./index.ts). Renderers are pure/presentational: given an element (and,
// for media types, an optional pre-resolved asset URL + the canvas's current
// px-per-canvas-reference-px scale), they render — no drag/resize/selection
// chrome, which stays owned by EditorCanvas.
import type { SceneElement } from "../../../services/scena-api/boards";

export interface ElementRendererProps {
  element: SceneElement;
  /** Pre-resolved signed URL for element.asset_id (or, for asset_page
   * elements, element.asset_page_id) — supplied by the board page's
   * upfront asset preview fetch when available. Media renderers fall back
   * to resolving their own asset(s) when this is absent, e.g. a carousel's
   * additional asset_ids, or an asset outside the parent's warm cache. */
  assetUrl?: string;
  /** Full asset-id/asset-page-id -> signed URL cache the board page warmed
   * up front. Only `carousel` consumes this directly (it needs more than
   * one Asset's URL); every other renderer uses the singular `assetUrl`. */
  assetUrls?: ReadonlyMap<string, string>;
  /** Actual DOM pixels per canvas-reference pixel at the current zoom
   * (mirrors EditorCanvas's internal `scale`). Config sizes — font_size,
   * corner_radius — are authored in canvas-reference px and must be
   * multiplied by this to render at the correct on-screen size. */
  scale: number;
}
