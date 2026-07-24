import { readTickerConfig } from "../../../services/scena-api/boards";
import { textRunStyle } from "./shared";
import type { ElementRendererProps } from "./types";

// A horizontally scrolling text band. The scroll is pure CSS (keyframes in
// editor.css) — no JS animation loop. Content is duplicated so the loop is
// seamless (the keyframe translates by exactly -50%, the width of one copy).
// prefers-reduced-motion is handled entirely in CSS so it always applies,
// even if this component's own logic has a bug.
export function TickerElement({ element, scale }: ElementRendererProps) {
  const config = readTickerConfig(element);
  const text = config.text || "Add ticker content";
  const directionClass = config.direction === "right" ? "scena-editor__renderer-ticker--right" : "scena-editor__renderer-ticker--left";
  const pausedClass = config.paused ? "scena-editor__renderer-ticker--paused" : "";

  return (
    <div className="scena-editor__renderer-ticker-track" style={{ background: config.background || undefined }}>
      <div
        className={["scena-editor__renderer-ticker", directionClass, pausedClass].filter(Boolean).join(" ")}
        style={{
          ...textRunStyle(config, scale),
          // textRunStyle wraps/wraps-anywhere for boxed text; a ticker must
          // stay on one line and overflow so the scroll animation works.
          whiteSpace: "nowrap",
          maxWidth: "none",
          overflowWrap: "normal",
          animationDuration: `${config.duration_s}s`,
        }}
      >
        <span>{text}</span>
        <span aria-hidden="true">{text}</span>
      </div>
    </div>
  );
}
