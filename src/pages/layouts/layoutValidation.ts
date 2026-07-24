// Client-side mirrors of the DB CHECK constraints on display_layouts and of
// validateTileGeometry in src/domain/layouts.ts (not exported from there —
// duplicated here on purpose so the UI can show inline errors before the
// request round-trip, instead of waiting on a server error).

export interface LayoutFieldValues {
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
}

export interface LayoutFieldErrors {
  name?: string;
  canvasWidth?: string;
  canvasHeight?: string;
  backgroundColor?: string;
}

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

/** Mirrors: name 1–120 chars trimmed; canvas_width/canvas_height 64–7680;
 * background_color a 6- or 8-digit hex color. */
export function validateLayoutFields(values: LayoutFieldValues): LayoutFieldErrors {
  const errors: LayoutFieldErrors = {};
  const trimmedName = values.name.trim();
  if (trimmedName.length < 1 || trimmedName.length > 120) {
    errors.name = "Name must be 1–120 characters.";
  }
  if (!Number.isFinite(values.canvasWidth) || values.canvasWidth < 64 || values.canvasWidth > 7680) {
    errors.canvasWidth = "Width must be between 64 and 7680.";
  }
  if (!Number.isFinite(values.canvasHeight) || values.canvasHeight < 64 || values.canvasHeight > 7680) {
    errors.canvasHeight = "Height must be between 64 and 7680.";
  }
  if (!HEX_COLOR_RE.test(values.backgroundColor)) {
    errors.backgroundColor = "Must be a hex color, e.g. #000000.";
  }
  return errors;
}

export interface TileFieldValues {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export interface TileFieldErrors {
  xPercent?: string;
  yPercent?: string;
  widthPercent?: string;
  heightPercent?: string;
}

/** Mirrors validateTileGeometry (src/domain/layouts.ts:153-163): each
 * percent is 0–100, width/height must be > 0, and x + width / y + height
 * must not exceed 100. */
export function validateTileFields(values: TileFieldValues): TileFieldErrors {
  const errors: TileFieldErrors = {};
  const { xPercent, yPercent, widthPercent, heightPercent } = values;

  if (!Number.isFinite(xPercent) || xPercent < 0 || xPercent > 100) errors.xPercent = "Must be between 0 and 100.";
  if (!Number.isFinite(yPercent) || yPercent < 0 || yPercent > 100) errors.yPercent = "Must be between 0 and 100.";
  if (!Number.isFinite(widthPercent) || widthPercent < 0 || widthPercent > 100) errors.widthPercent = "Must be between 0 and 100.";
  if (!Number.isFinite(heightPercent) || heightPercent < 0 || heightPercent > 100) errors.heightPercent = "Must be between 0 and 100.";

  if (!errors.widthPercent && widthPercent <= 0) errors.widthPercent = "Width must be greater than 0.";
  if (!errors.heightPercent && heightPercent <= 0) errors.heightPercent = "Height must be greater than 0.";

  if (!errors.xPercent && !errors.widthPercent && xPercent + widthPercent > 100) {
    errors.widthPercent = "Tile extends past the right edge of the canvas.";
  }
  if (!errors.yPercent && !errors.heightPercent && yPercent + heightPercent > 100) {
    errors.heightPercent = "Tile extends past the bottom edge of the canvas.";
  }
  return errors;
}
