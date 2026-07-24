import { callScenaFunction } from "./client";
import { isBoardVersionConflict } from "./errors";

export type BoardStatus = "active" | "archived";
export type ElementType =
  | "text"
  | "image"
  | "shape"
  | "asset_page"
  | "clock"
  | "date"
  | "countdown"
  | "qr_static"
  | "qr_dynamic"
  | "music_player"
  | "ticker"
  | "carousel"
  | "video"
  | "weather"
  | "data_text";
export type ShapeVariant =
  | "rectangle"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "hexagon"
  | "star"
  | "line"
  | "arrow";
export const SHAPE_VARIANTS: readonly ShapeVariant[] = [
  "rectangle",
  "ellipse",
  "triangle",
  "diamond",
  "hexagon",
  "star",
  "line",
  "arrow",
];

export type BorderStyle = "solid" | "dashed" | "dotted";

export type RenderMode = "static" | "live" | "interactive";
export type TransitionType =
  | "none"
  | "fade"
  | "slide_left"
  | "slide_right"
  | "zoom"
  | "dissolve";

export interface BoardSummary {
  id: string;
  workspace_id: string;
  name: string;
  canvas_width: number;
  canvas_height: number;
  background_color: string;
  status: BoardStatus;
  version: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface SceneElement {
  id: string;
  element_type: ElementType;
  render_mode: RenderMode;
  name: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  z_index: number;
  is_locked: boolean;
  is_visible: boolean;
  asset_id: string | null;
  asset_page_id: string | null;
  config: Record<string, unknown>;
}

/** Generic border config, applicable to every element type. border_width of
 * 0 is the explicit "no border" state — not merely a falsy default. */
export interface ElementBorderConfig {
  border_width: number;
  border_color: string;
  border_style: BorderStyle;
}

/** Shape-only config: geometry variant, fill (+opacity), corner radius,
 * plus the generic border fields every element type also reads. */
export interface ShapeConfig extends ElementBorderConfig {
  variant: ShapeVariant;
  fill: string;
  fill_opacity: number;
  corner_radius: number;
}

const DEFAULT_BORDER_CONFIG: ElementBorderConfig = {
  border_width: 0,
  border_color: "#ffffff",
  border_style: "solid",
};

/** Normalizing reader for the generic border config keys. Backward
 * compatible with elements saved before borders existed: a missing
 * border_width reads as 0 (borderless), not an error. */
export function readBorderConfig(element: { config: Record<string, unknown> | null | undefined }): ElementBorderConfig {
  const config = (element.config ?? {}) as Record<string, unknown>;
  const width = Number(config.border_width);
  const style = config.border_style;
  return {
    border_width: Number.isFinite(width) && width >= 0 ? width : DEFAULT_BORDER_CONFIG.border_width,
    border_color: typeof config.border_color === "string" && config.border_color ? config.border_color : DEFAULT_BORDER_CONFIG.border_color,
    border_style: style === "dashed" || style === "dotted" || style === "solid" ? style : DEFAULT_BORDER_CONFIG.border_style,
  };
}

/** Normalizing reader for shape config. A missing variant reads as
 * "rectangle" so elements saved with config `{}` or `{ fill: "#xxx" }`
 * (pre-variant, pre-border) keep rendering. */
export function readShapeConfig(element: { config: Record<string, unknown> | null | undefined }): ShapeConfig {
  const config = (element.config ?? {}) as Record<string, unknown>;
  const variantValue = typeof config.variant === "string" ? config.variant : "rectangle";
  const variant: ShapeVariant = (SHAPE_VARIANTS as readonly string[]).includes(variantValue)
    ? (variantValue as ShapeVariant)
    : "rectangle";
  const fillOpacity = Number(config.fill_opacity);
  const cornerRadius = Number(config.corner_radius);
  return {
    ...readBorderConfig(element),
    variant,
    fill: typeof config.fill === "string" && config.fill ? config.fill : "#5b7cfa",
    fill_opacity: Number.isFinite(fillOpacity) ? Math.min(1, Math.max(0, fillOpacity)) : 1,
    corner_radius: Number.isFinite(cornerRadius) && cornerRadius >= 0 ? cornerRadius : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Per-element config contracts                                        */
/*                                                                     */
/* `scene_elements.config` is jsonb constrained only by                */
/* `jsonb_typeof(config) = 'object'`, so these shapes are a client-side */
/* convention — adding a key never requires a migration. Every reader   */
/* below is total: it must return a usable config for `{}` so elements  */
/* saved before a key existed keep rendering.                          */
/* ------------------------------------------------------------------ */

export type TextAlign = "left" | "center" | "right";
export type VerticalAlign = "top" | "middle" | "bottom";
export type FontFamilyToken = "body" | "display" | "mono";

/** Shared typography, read by every text-bearing element type
 * (text, clock, date, countdown, ticker, weather, data_text). */
export interface TextStyleConfig {
  font_size: number;
  font_weight: number;
  font_family: FontFamilyToken;
  color: string;
  align: TextAlign;
  vertical_align: VerticalAlign;
  line_height: number;
  italic: boolean;
  underline: boolean;
  background: string;
}

const DEFAULT_TEXT_STYLE: TextStyleConfig = {
  font_size: 48,
  font_weight: 600,
  font_family: "body",
  color: "#ffffff",
  align: "left",
  vertical_align: "middle",
  line_height: 1.2,
  italic: false,
  underline: false,
  background: "",
};

export const FONT_FAMILY_TOKENS: readonly FontFamilyToken[] = ["body", "display", "mono"];
export const TEXT_ALIGNS: readonly TextAlign[] = ["left", "center", "right"];
export const VERTICAL_ALIGNS: readonly VerticalAlign[] = ["top", "middle", "bottom"];
export const FONT_WEIGHTS: readonly number[] = [400, 500, 600, 700, 800];

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}
function num(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}
function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}
function cfg(element: { config: Record<string, unknown> | null | undefined }): Record<string, unknown> {
  return (element.config ?? {}) as Record<string, unknown>;
}

export function readTextStyle(element: { config: Record<string, unknown> | null | undefined }): TextStyleConfig {
  const c = cfg(element);
  return {
    font_size: num(c.font_size, DEFAULT_TEXT_STYLE.font_size, 4, 800),
    font_weight: FONT_WEIGHTS.includes(Number(c.font_weight)) ? Number(c.font_weight) : DEFAULT_TEXT_STYLE.font_weight,
    font_family: oneOf(c.font_family, FONT_FAMILY_TOKENS, DEFAULT_TEXT_STYLE.font_family),
    color: str(c.color, DEFAULT_TEXT_STYLE.color),
    align: oneOf(c.align, TEXT_ALIGNS, DEFAULT_TEXT_STYLE.align),
    vertical_align: oneOf(c.vertical_align, VERTICAL_ALIGNS, DEFAULT_TEXT_STYLE.vertical_align),
    line_height: num(c.line_height, DEFAULT_TEXT_STYLE.line_height, 0.5, 4),
    italic: bool(c.italic, DEFAULT_TEXT_STYLE.italic),
    underline: bool(c.underline, DEFAULT_TEXT_STYLE.underline),
    background: typeof c.background === "string" ? c.background : DEFAULT_TEXT_STYLE.background,
  };
}

export type ObjectFit = "contain" | "cover" | "fill";
export const OBJECT_FITS: readonly ObjectFit[] = ["contain", "cover", "fill"];

/** Media framing, shared by image / asset_page / carousel / video. */
export interface MediaConfig extends ElementBorderConfig {
  fit: ObjectFit;
  corner_radius: number;
  alt: string;
}

export function readMediaConfig(element: { config: Record<string, unknown> | null | undefined }): MediaConfig {
  const c = cfg(element);
  return {
    ...readBorderConfig(element),
    fit: oneOf(c.fit, OBJECT_FITS, "contain"),
    corner_radius: num(c.corner_radius, 0, 0, 400),
    alt: typeof c.alt === "string" ? c.alt : "",
  };
}

export type TimeFormat = "12h" | "24h";
export interface ClockConfig extends TextStyleConfig, ElementBorderConfig {
  time_format: TimeFormat;
  show_seconds: boolean;
  /** IANA zone; "" renders in the viewing device's local zone. */
  timezone: string;
}
export function readClockConfig(element: { config: Record<string, unknown> | null | undefined }): ClockConfig {
  const c = cfg(element);
  const legacyFormat = c.format === "hh:mm A" ? "12h" : "24h";
  return {
    ...readTextStyle(element),
    ...readBorderConfig(element),
    time_format: oneOf(c.time_format, ["12h", "24h"] as const, legacyFormat),
    show_seconds: typeof c.show_seconds === "boolean" ? c.show_seconds : c.format === "HH:mm:ss",
    timezone: typeof c.timezone === "string" ? c.timezone : typeof c.time_zone === "string" ? c.time_zone : "",
  };
}

export type DateFormat = "long" | "medium" | "short" | "weekday" | "iso";
export const DATE_FORMATS: readonly DateFormat[] = ["long", "medium", "short", "weekday", "iso"];
export interface DateConfig extends TextStyleConfig, ElementBorderConfig {
  date_format: DateFormat;
  timezone: string;
}
export function readDateConfig(element: { config: Record<string, unknown> | null | undefined }): DateConfig {
  const c = cfg(element);
  const legacyFormat = c.format === "MMMM d, yyyy" ? "long" : c.format === "dd/MM/yyyy" || c.format === "MM/dd/yyyy" ? "short" : "medium";
  return {
    ...readTextStyle(element),
    ...readBorderConfig(element),
    date_format: oneOf(c.date_format, DATE_FORMATS, legacyFormat),
    timezone: typeof c.timezone === "string" ? c.timezone : typeof c.time_zone === "string" ? c.time_zone : "",
  };
}

export type CountdownUnits = "dhms" | "hms" | "ms";
export interface CountdownConfig extends TextStyleConfig, ElementBorderConfig {
  /** ISO datetime the countdown ends at. "" = unset. */
  target: string;
  units: CountdownUnits;
  expired_text: string;
  show_labels: boolean;
}
export function readCountdownConfig(element: { config: Record<string, unknown> | null | undefined }): CountdownConfig {
  const c = cfg(element);
  const legacyFormat = c.format === "hours_minutes_seconds" ? "hms" : "dhms";
  return {
    ...readTextStyle(element),
    ...readBorderConfig(element),
    target: typeof c.target === "string" ? c.target : typeof c.end_at === "string" ? c.end_at : "",
    units: oneOf(c.units, ["dhms", "hms", "ms"] as const, legacyFormat),
    expired_text: typeof c.expired_text === "string" ? c.expired_text : "Time's up",
    show_labels: bool(c.show_labels, true),
  };
}

export interface TickerConfig extends TextStyleConfig, ElementBorderConfig {
  text: string;
  /** Seconds for one full pass. Higher = slower. */
  duration_s: number;
  direction: "left" | "right";
  paused: boolean;
}
export function readTickerConfig(element: { config: Record<string, unknown> | null | undefined }): TickerConfig {
  const c = cfg(element);
  const legacyItems = Array.isArray(c.items) ? c.items.filter((item): item is string => typeof item === "string").join("   •   ") : "";
  return {
    ...readTextStyle(element),
    ...readBorderConfig(element),
    text: typeof c.text === "string" ? c.text : legacyItems || "Scrolling announcement",
    duration_s: num(c.duration_s, num(c.speed, 20, 2, 300), 2, 300),
    direction: oneOf(c.direction, ["left", "right"] as const, "left"),
    paused: typeof c.paused === "boolean" ? c.paused : c.autoplay === false,
  };
}

export type QrErrorCorrection = "L" | "M" | "Q" | "H";
export const QR_ERROR_CORRECTIONS: readonly QrErrorCorrection[] = ["L", "M", "Q", "H"];
export interface QrConfig extends ElementBorderConfig {
  /** Encoded payload. For qr_dynamic this is the redirect target. */
  value: string;
  foreground: string;
  background: string;
  /** Quiet-zone modules around the symbol. */
  margin: number;
  error_correction: QrErrorCorrection;
}
export function readQrConfig(element: { config: Record<string, unknown> | null | undefined }): QrConfig {
  const c = cfg(element);
  return {
    ...readBorderConfig(element),
    value: typeof c.value === "string" ? c.value : typeof c.target === "string" ? c.target : typeof c.url === "string" ? c.url : "",
    foreground: str(c.foreground, "#000000"),
    background: str(c.background, "#ffffff"),
    margin: num(c.margin, 2, 0, 16),
    error_correction: oneOf(c.error_correction, QR_ERROR_CORRECTIONS, "M"),
  };
}

export interface CarouselConfig extends MediaConfig {
  asset_ids: string[];
  interval_ms: number;
  transition: "fade" | "slide" | "none";
}
export function readCarouselConfig(element: { config: Record<string, unknown> | null | undefined }): CarouselConfig {
  const c = cfg(element);
  const ids = Array.isArray(c.asset_ids) ? c.asset_ids.filter((id): id is string => typeof id === "string") : [];
  return {
    ...readMediaConfig(element),
    asset_ids: ids,
    interval_ms: num(c.interval_ms, 5000, 1000, 600000),
    transition: oneOf(c.transition, ["fade", "slide", "none"] as const, "fade"),
  };
}

export interface AssetPageConfig extends MediaConfig {
  /** 1-based page index within a multi-page Asset (pdf/powerpoint). */
  page_number: number;
}
export function readAssetPageConfig(element: { config: Record<string, unknown> | null | undefined }): AssetPageConfig {
  return { ...readMediaConfig(element), page_number: num(cfg(element).page_number, 1, 1, 10000) };
}

/* --- Types with no backend yet ------------------------------------- */
/* These render a configurable PREVIEW in the editor and state plainly  */
/* that no data source exists. They must never display invented live    */
/* values as though they were real.                                     */

export type TemperatureUnits = "metric" | "imperial";
export interface WeatherConfig extends TextStyleConfig, ElementBorderConfig {
  location: string;
  units: TemperatureUnits;
  show_condition: boolean;
}
export function readWeatherConfig(element: { config: Record<string, unknown> | null | undefined }): WeatherConfig {
  const c = cfg(element);
  return {
    ...readTextStyle(element),
    ...readBorderConfig(element),
    location: typeof c.location === "string" ? c.location : "",
    units: oneOf(c.units, ["metric", "imperial"] as const, c.units === "celsius" ? "metric" : "imperial"),
    show_condition: bool(c.show_condition, true),
  };
}

export interface VideoConfig extends MediaConfig {
  loop: boolean;
  muted: boolean;
  autoplay: boolean;
}
export function readVideoConfig(element: { config: Record<string, unknown> | null | undefined }): VideoConfig {
  const c = cfg(element);
  return { ...readMediaConfig(element), loop: bool(c.loop, true), muted: bool(c.muted, true), autoplay: bool(c.autoplay, true) };
}

export interface MusicPlayerConfig extends ElementBorderConfig {
  show_artwork: boolean;
  show_progress: boolean;
  accent: string;
}
export function readMusicPlayerConfig(element: { config: Record<string, unknown> | null | undefined }): MusicPlayerConfig {
  const c = cfg(element);
  return {
    ...readBorderConfig(element),
    show_artwork: bool(c.show_artwork, true),
    show_progress: bool(c.show_progress, true),
    accent: str(c.accent, "#5b7cfa"),
  };
}

export interface DataTextConfig extends TextStyleConfig, ElementBorderConfig {
  /** Dot-path into a future live-data payload, e.g. "store.queue_length". */
  source_key: string;
  prefix: string;
  suffix: string;
  fallback: string;
}
export function readDataTextConfig(element: { config: Record<string, unknown> | null | undefined }): DataTextConfig {
  const c = cfg(element);
  return {
    ...readTextStyle(element),
    ...readBorderConfig(element),
    source_key: typeof c.source_key === "string" ? c.source_key : typeof c.key === "string" ? c.key : "",
    prefix: typeof c.prefix === "string" ? c.prefix : "",
    suffix: typeof c.suffix === "string" ? c.suffix : "",
    fallback: typeof c.fallback === "string" ? c.fallback : "—",
  };
}

/** Element types whose live data source does not exist yet. The editor
 * renders a configurable preview for these and says so explicitly. */
export const ELEMENTS_WITHOUT_DATA_SOURCE: readonly ElementType[] = ["weather", "video", "music_player", "data_text"];

export interface BoardScene {
  id: string;
  name: string;
  sort_order: number;
  duration_ms: number;
  transition_type: TransitionType;
  transition_config: Record<string, unknown>;
  background: Record<string, unknown>;
  is_hidden: boolean;
  elements: SceneElement[];
}

export interface BoardSnapshot {
  board: {
    id?: string;
    workspace_id?: string;
    name: string;
    canvas_width: number;
    canvas_height: number;
    background_color: string;
    status?: BoardStatus;
    version?: number;
  };
  scenes: BoardScene[];
}

export interface BoardRevision {
  id: string;
  workspace_id: string;
  board_id: string;
  board_version: number;
  label: string | null;
  created_by: string;
  created_at: string;
}

export interface CreateBoardInput {
  workspaceId: string;
  name: string;
  canvasWidth?: number;
  canvasHeight?: number;
  backgroundColor?: string;
  signal?: AbortSignal;
}

export async function listBoards(
  workspaceId: string,
  limit = 50,
  signal?: AbortSignal,
): Promise<{ boards: BoardSummary[]; request_id: string }> {
  return callScenaFunction(
    "board-interaction",
    {
      action: "list",
      workspace_id: workspaceId,
      limit,
    },
    { signal },
  );
}

export async function createBoard(
  input: CreateBoardInput,
): Promise<{ board: BoardSummary; initial_scene_id: string; request_id: string }> {
  return callScenaFunction(
    "board-interaction",
    {
      action: "create",
      workspace_id: input.workspaceId,
      name: input.name,
      canvas_width: input.canvasWidth ?? 1920,
      canvas_height: input.canvasHeight ?? 1080,
      background_color: input.backgroundColor ?? "#000000",
    },
    { signal: input.signal },
  );
}

export async function getBoard(
  boardId: string,
  signal?: AbortSignal,
): Promise<{ snapshot: BoardSnapshot; request_id: string }> {
  return callScenaFunction(
    "board-interaction",
    { action: "get", board_id: boardId },
    { signal },
  );
}

export async function saveBoard(
  boardId: string,
  baseVersion: number,
  snapshot: BoardSnapshot,
  signal?: AbortSignal,
): Promise<{
  board_id: string;
  version: number;
  scene_count: number;
  element_count: number;
  request_id: string;
}> {
  return callScenaFunction(
    "board-interaction",
    {
      action: "save",
      board_id: boardId,
      base_version: baseVersion,
      snapshot,
    },
    { signal },
  );
}

export async function createBoardRevision(
  boardId: string,
  label?: string,
  signal?: AbortSignal,
): Promise<{
  revision_id: string;
  board_id: string;
  version: number;
  request_id: string;
}> {
  return callScenaFunction(
    "board-interaction",
    {
      action: "create_revision",
      board_id: boardId,
      ...(label ? { label } : {}),
    },
    { signal },
  );
}

export async function listBoardRevisions(
  boardId: string,
  limit = 25,
  signal?: AbortSignal,
): Promise<{ revisions: BoardRevision[]; request_id: string }> {
  return callScenaFunction(
    "board-interaction",
    {
      action: "list_revisions",
      board_id: boardId,
      limit,
    },
    { signal },
  );
}

export async function archiveBoard(
  boardId: string,
  signal?: AbortSignal,
): Promise<{ board_id: string; status: "archived"; request_id: string }> {
  return callScenaFunction(
    "board-interaction",
    { action: "archive", board_id: boardId },
    { signal },
  );
}

export function createBlankBoardSnapshot(
  board: BoardSummary,
  initialSceneId: string,
): BoardSnapshot {
  return {
    board: {
      id: board.id,
      workspace_id: board.workspace_id,
      name: board.name,
      canvas_width: board.canvas_width,
      canvas_height: board.canvas_height,
      background_color: board.background_color,
      status: board.status,
      version: board.version,
    },
    scenes: [
      {
        id: initialSceneId,
        name: "Scene 1",
        sort_order: 0,
        duration_ms: 10_000,
        transition_type: "fade",
        transition_config: {},
        background: {
          type: "color",
          value: board.background_color,
        },
        is_hidden: false,
        elements: [],
      },
    ],
  };
}

export { isBoardVersionConflict };
