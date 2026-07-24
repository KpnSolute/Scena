// Helpers shared by the element renderers: text-style -> CSS translation,
// a live-clock ticker hook, an asset-resolution hook (signed URL + loading/
// error state, cancel-safe), and small presentational primitives (loading
// skeleton frame, honest placeholder, "preview only" disclosure badge).
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { getAssetPreview } from "../../../services/scena-api/assets";
import type {
  FontFamilyToken, TextAlign, TextStyleConfig, VerticalAlign,
} from "../../../services/scena-api/boards";
import { Skeleton } from "../../ui/Skeleton";

const FONT_FAMILY_VARS: Record<FontFamilyToken, string> = {
  body: "var(--scena-font-body)",
  display: "var(--scena-font-display)",
  mono: "var(--scena-font-mono)",
};

const HORIZONTAL_ALIGN: Record<TextAlign, CSSProperties["justifyContent"]> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

const VERTICAL_ALIGN: Record<VerticalAlign, CSSProperties["alignItems"]> = {
  top: "flex-start",
  middle: "center",
  bottom: "flex-end",
};

/** Positions the text run within the element's full box per align/vertical_align.
 * Renders as its own flex container so it fully overrides the generic
 * center/center the shared `.scena-editor__element-body` wrapper applies. */
export function textFrameStyle(style: Pick<TextStyleConfig, "align" | "vertical_align">): CSSProperties {
  return {
    width: "100%",
    height: "100%",
    display: "flex",
    justifyContent: HORIZONTAL_ALIGN[style.align],
    alignItems: VERTICAL_ALIGN[style.vertical_align],
    boxSizing: "border-box",
  };
}

/** Font/color/decoration for the text run itself. `font_size` is authored in
 * canvas-reference px, so it is multiplied by `scale` (the canvas's current
 * px-per-reference-px factor) to land at the correct on-screen size at any
 * zoom level — a fixed px or viewport-relative value would not track zoom. */
export function textRunStyle(style: TextStyleConfig, scale: number): CSSProperties {
  return {
    fontFamily: FONT_FAMILY_VARS[style.font_family],
    fontSize: `${Math.max(1, style.font_size * scale)}px`,
    fontWeight: style.font_weight,
    color: style.color,
    lineHeight: style.line_height,
    fontStyle: style.italic ? "italic" : "normal",
    textDecoration: style.underline ? "underline" : "none",
    textAlign: style.align,
    background: style.background || undefined,
    padding: style.background ? "0.15em 0.4em" : undefined,
    borderRadius: style.background ? "0.2em" : undefined,
    maxWidth: "100%",
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
  };
}

/** Live-updating value on a fixed interval; clears on unmount. Callers pick
 * the interval (1s while seconds are shown, 60s otherwise for clock/date) so
 * a per-minute display isn't re-rendered every second for nothing. */
export function useTick(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export type AssetLoadState =
  | { status: "empty" }
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error"; message: string };

/** Resolves a signed preview URL for an Asset (optionally scoped to one
 * page), preferring a pre-resolved URL the board page already fetched. Only
 * hits the network when no pre-resolved URL is available. Cancels in-flight
 * work on unmount / when inputs change, and never sets state afterward. */
export function useAssetPreview(
  assetId: string | null,
  presetUrl: string | undefined,
  scope: { pageId?: string | null; pageNumber?: number | null } = {},
): AssetLoadState {
  const pageId = scope.pageId ?? null;
  const pageNumber = scope.pageNumber ?? null;

  const [state, setState] = useState<AssetLoadState>(() =>
    presetUrl ? { status: "ready", url: presetUrl } : assetId ? { status: "loading" } : { status: "empty" },
  );

  useEffect(() => {
    if (presetUrl) {
      setState({ status: "ready", url: presetUrl });
      return;
    }
    if (!assetId) {
      setState({ status: "empty" });
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setState({ status: "loading" });
    getAssetPreview(assetId, {
      pageId: pageId ?? undefined,
      pageNumber: pageNumber ?? undefined,
      preference: "full",
      signal: controller.signal,
    })
      .then((preview) => {
        if (!cancelled) setState({ status: "ready", url: preview.signed_url });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error", message: error instanceof Error ? error.message : "This asset couldn't be loaded." });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [assetId, presetUrl, pageId, pageNumber]);

  return state;
}

/** Loading state for a media frame — fills the element body, honors the
 * caller's corner rounding so the skeleton doesn't flash square corners
 * before a rounded image loads in. */
export function MediaSkeleton({ style }: { style?: CSSProperties }) {
  return (
    <div style={{ width: "100%", height: "100%", ...style }}>
      <Skeleton width="100%" height="100%" radius="0" />
    </div>
  );
}

/** Honest, non-crashing placeholder for "nothing to show" and "failed to
 * load" media states — never a fake image or invented content. */
export function MediaPlaceholder({
  message, tone = "muted", style,
}: { message: string; tone?: "muted" | "error"; style?: CSSProperties }) {
  return (
    <div className={`scena-editor__renderer-media-placeholder scena-editor__renderer-media-placeholder--${tone}`} style={style}>
      {tone === "error" && <WarningCircle size={18} aria-hidden="true" />}
      <span>{message}</span>
    </div>
  );
}

/** Disclosure badge for the four element types with no live data source yet
 * (weather, video, music_player, data_text) — every preview using it must
 * reflect the user's actual configuration, never an invented live value. */
export function PreviewBadge({ children }: { children?: ReactNode }) {
  return (
    <span className="scena-editor__renderer-preview-badge">
      {children ?? "Preview — no live data source yet"}
    </span>
  );
}

export function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
