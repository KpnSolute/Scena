// Canvas rendering + drag/resize/rotate. Interaction state (the in-flight
// drag/resize/rotate delta) stays local to this component; only the final
// value on pointer-up is committed to the editor's undo-tracked state, so a
// whole drag gesture is one undo step, not one per pixel of movement.
import { useRef, useState } from "react";
import type { BoardScene, SceneElement, ShapeVariant } from "../../services/scena-api/boards";
import { readBorderConfig, readMediaConfig, readShapeConfig } from "../../services/scena-api/boards";
import { getElementRenderer, type ElementRendererProps } from "./elements";
import { sceneTypeOf, signLayoutOf } from "../../domain/boardSceneTypes";

type DragKind = "move" | "resize-nw" | "resize-ne" | "resize-sw" | "resize-se" | "rotate";

interface DragState {
  kind: DragKind;
  elementId: string;
  startX: number;
  startY: number;
  origin: { x: number; y: number; width: number; height: number; rotation: number };
}

export interface EditorCanvasProps {
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  scene: BoardScene;
  selectedElementId: string | null;
  onSelect: (elementId: string | null) => void;
  onCommit: (elementId: string, patch: Partial<SceneElement>) => void;
  zoom: number;
  /** Signed, short-lived asset URLs resolved by the board page. */
  assetPreviewUrls?: ReadonlyMap<string, string>;
}

const BASE_SCALE = 0.4;
const SNAP_THRESHOLD = 1.5;

export function EditorCanvas({
  canvasWidth, canvasHeight, backgroundColor, scene, selectedElementId, onSelect, onCommit, zoom, assetPreviewUrls,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [live, setLive] = useState<Partial<SceneElement> | null>(null);
  const [snapLines, setSnapLines] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });

  const scale = (zoom / 100) * BASE_SCALE;
  const displayWidth = canvasWidth * scale;
  const displayHeight = canvasHeight * scale;

  function beginDrag(kind: DragKind, element: SceneElement, event: React.PointerEvent) {
    if (element.is_locked && kind === "move") return;
    event.stopPropagation();
    onSelect(element.id);
    (event.target as Element).setPointerCapture(event.pointerId);
    setDrag({
      kind,
      elementId: element.id,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: element.x, y: element.y, width: element.width, height: element.height, rotation: element.rotation },
    });
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!drag || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dxPercent = ((event.clientX - drag.startX) / rect.width) * 100;
    const dyPercent = ((event.clientY - drag.startY) / rect.height) * 100;

    if (drag.kind === "move") {
      let x = clamp(drag.origin.x + dxPercent, 0, 100 - drag.origin.width);
      let y = clamp(drag.origin.y + dyPercent, 0, 100 - drag.origin.height);
      const centerX = x + drag.origin.width / 2;
      const centerY = y + drag.origin.height / 2;
      const snapV = Math.abs(centerX - 50) < SNAP_THRESHOLD;
      const snapH = Math.abs(centerY - 50) < SNAP_THRESHOLD;
      if (snapV) x = 50 - drag.origin.width / 2;
      if (snapH) y = 50 - drag.origin.height / 2;
      setSnapLines({ v: snapV, h: snapH });
      setLive({ x, y });
    } else if (drag.kind.startsWith("resize")) {
      const edge = drag.kind.replace("resize-", "");
      let { x, y, width, height } = drag.origin;
      if (edge.includes("e")) width = clamp(drag.origin.width + dxPercent, 4, 100 - drag.origin.x);
      if (edge.includes("s")) height = clamp(drag.origin.height + dyPercent, 4, 100 - drag.origin.y);
      if (edge.includes("w")) {
        width = clamp(drag.origin.width - dxPercent, 4, drag.origin.x + drag.origin.width);
        x = drag.origin.x + drag.origin.width - width;
      }
      if (edge.includes("n")) {
        height = clamp(drag.origin.height - dyPercent, 4, drag.origin.y + drag.origin.height);
        y = drag.origin.y + drag.origin.height - height;
      }
      setLive({ x, y, width, height });
    } else if (drag.kind === "rotate") {
      const angle = Math.round((Math.atan2(event.clientY - rect.top, event.clientX - rect.left) * 180) / Math.PI) + 90;
      setLive({ rotation: ((angle % 360) + 360) % 360 });
    }
  }

  function endDrag() {
    if (drag && live) onCommit(drag.elementId, live);
    setDrag(null);
    setLive(null);
    setSnapLines({ v: false, h: false });
  }

  return (
    <div className="scena-editor__canvas-wrap">
      <div
        ref={canvasRef}
        className="scena-editor__canvas"
        style={{ width: displayWidth, height: displayHeight, background: backgroundColor }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onClick={() => onSelect(null)}
      >
        {sceneTypeOf(scene) === "presentation" && typeof scene.config.asset_id === "string" && assetPreviewUrls?.get(scene.config.asset_id) && (
          <img className="scena-editor__presentation-preview" src={assetPreviewUrls.get(scene.config.asset_id)} alt="First slide preview" />
        )}
        {sceneTypeOf(scene) === "sign" && (
          <div className="scena-editor__zone-layer" aria-hidden="true">
            {signLayoutOf(scene).zones.map((zone) => (
              <div key={zone.id} className={`scena-editor__zone scena-editor__zone--${zone.role}`} style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%` }}>
                <span>{zone.label}</span>
              </div>
            ))}
          </div>
        )}
        {snapLines.v && <div className="scena-editor__snap-line scena-editor__snap-line--v" style={{ left: "50%" }} />}
        {snapLines.h && <div className="scena-editor__snap-line scena-editor__snap-line--h" style={{ top: "50%" }} />}

        {[...scene.elements].sort((a, b) => a.z_index - b.z_index).map((element) => {
          const isSelected = element.id === selectedElementId;
          const applied = isSelected && drag?.elementId === element.id && live ? { ...element, ...live } : element;
          return (
            <div
              key={element.id}
              className={[
                "scena-editor__element",
                isSelected && "scena-editor__element--selected",
                element.is_locked && "scena-editor__element--locked",
                !element.is_visible && "scena-editor__element--hidden",
              ].filter(Boolean).join(" ")}
              style={{
                left: `${applied.x}%`,
                top: `${applied.y}%`,
                width: `${applied.width}%`,
                height: `${applied.height}%`,
                transform: `rotate(${applied.rotation}deg)`,
                opacity: applied.opacity,
                zIndex: element.z_index,
              }}
              onPointerDown={(event) => beginDrag("move", element, event)}
              // pointerdown's stopPropagation doesn't cover the separate
              // click event, which would bubble to the canvas's
              // deselect-on-click and instantly undo the selection.
              onClick={(event) => event.stopPropagation()}
            >
              <div className="scena-editor__element-body" style={elementBodyStyle(element, scale)}>
                {element.element_type === "shape" ? (
                  <ShapeBody element={element} />
                ) : (
                  <ElementRendererFor
                    element={element}
                    assetUrl={assetPreviewUrls?.get(element.asset_page_id ?? element.asset_id ?? "")}
                    assetUrls={assetPreviewUrls}
                    scale={scale}
                  />
                )}
              </div>
              {isSelected && !element.is_locked && (
                <>
                  <span className="scena-editor__handle scena-editor__handle--nw" onPointerDown={(event) => beginDrag("resize-nw", element, event)} />
                  <span className="scena-editor__handle scena-editor__handle--ne" onPointerDown={(event) => beginDrag("resize-ne", element, event)} />
                  <span className="scena-editor__handle scena-editor__handle--sw" onPointerDown={(event) => beginDrag("resize-sw", element, event)} />
                  <span className="scena-editor__handle scena-editor__handle--se" onPointerDown={(event) => beginDrag("resize-se", element, event)} />
                  <span className="scena-editor__handle scena-editor__handle--rotate" onPointerDown={(event) => beginDrag("rotate", element, event)} />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Element types whose config carries a MediaConfig (fit/corner_radius/alt)
 * — the generic wrapper below rounds their corners to match. */
const MEDIA_LIKE_TYPES: ReadonlySet<SceneElement["element_type"]> = new Set([
  "image", "asset_page", "carousel", "video",
]);

// Looks up the registered presentational renderer for a non-shape element
// type. Every ElementType but "shape" has an entry (shape keeps its own SVG
// path below); the fallback only guards against a future type landing in
// the union before a renderer is registered for it.
function ElementRendererFor(props: ElementRendererProps) {
  const Renderer = getElementRenderer(props.element.element_type);
  if (!Renderer) {
    return <span className="scena-editor__renderer-fallback">Unsupported element</span>;
  }
  return <Renderer {...props} />;
}

// Borders are a generic element property, honored for every element type —
// except shape, which draws its own border as part of its SVG geometry
// below (a plain CSS border on this box would fight with non-rectangular
// shapes: clip-path/SVG clipping clips a CSS border clean away). Border
// width and (for media-like types) corner radius are authored in
// canvas-reference px, so both are multiplied by `scale` — the canvas's
// current px-per-reference-px factor — to render at the correct physical
// size at any zoom level.
function elementBodyStyle(element: SceneElement, scale: number): React.CSSProperties {
  if (element.element_type === "shape") return {};
  const border = readBorderConfig(element);
  const cornerRadius = MEDIA_LIKE_TYPES.has(element.element_type) ? readMediaConfig(element).corner_radius : 0;
  return {
    boxSizing: "border-box",
    borderWidth: border.border_width * scale,
    borderStyle: border.border_width > 0 ? border.border_style : "none",
    borderColor: border.border_color,
    borderRadius: cornerRadius > 0 ? `${cornerRadius * scale}px` : undefined,
  };
}

// Non-rectangular shape geometry (percent-space polygon points, 0-100
// viewBox) for the variants CSS clip-path would otherwise handle — using
// SVG for every variant (not just the clipped ones) means fill + stroke
// stay in lockstep for all eight, including a border that actually shows
// up on a triangle, which a clip-path border cannot do on its own.
const SHAPE_POLYGON_POINTS: Partial<Record<ShapeVariant, string>> = {
  triangle: "50,4 96,94 4,94",
  diamond: "50,3 97,50 50,97 3,50",
  hexagon: "27,4 73,4 97,50 73,96 27,96 3,50",
  star: "50,2 61.76,33.82 95.65,35.17 69.02,56.18 78.21,88.83 50,70 21.79,88.83 30.98,56.18 4.35,35.17 38.24,33.82",
  arrow: "0,35 60,35 60,15 100,50 60,85 60,65 0,65",
};

function ShapeBody({ element }: { element: SceneElement }) {
  const cfg = readShapeConfig(element);
  const isLine = cfg.variant === "line";
  const hasBorder = cfg.border_width > 0;
  const strokeDasharray = cfg.border_style === "dashed" ? "6 4" : cfg.border_style === "dotted" ? "1.5 3" : undefined;
  const inset = cfg.border_width / 2;

  const shapeProps = {
    fill: isLine ? "none" : cfg.fill,
    fillOpacity: isLine ? undefined : cfg.fill_opacity,
    stroke: hasBorder ? cfg.border_color : "none",
    strokeWidth: hasBorder ? cfg.border_width : 0,
    strokeDasharray: hasBorder ? strokeDasharray : undefined,
    strokeLinecap: isLine ? ("round" as const) : undefined,
  };

  let geometry: React.ReactElement;
  switch (cfg.variant) {
    case "ellipse":
      geometry = <ellipse cx={50} cy={50} rx={Math.max(0, 50 - inset)} ry={Math.max(0, 50 - inset)} {...shapeProps} />;
      break;
    case "line":
      geometry = <line x1={0} y1={50} x2={100} y2={50} {...shapeProps} />;
      break;
    case "triangle":
    case "diamond":
    case "hexagon":
    case "star":
    case "arrow":
      geometry = <polygon points={SHAPE_POLYGON_POINTS[cfg.variant]} {...shapeProps} />;
      break;
    case "rectangle":
    default:
      geometry = (
        <rect
          x={inset}
          y={inset}
          width={Math.max(0, 100 - cfg.border_width)}
          height={Math.max(0, 100 - cfg.border_width)}
          rx={cfg.corner_radius}
          ry={cfg.corner_radius}
          {...shapeProps}
        />
      );
  }

  return (
    <svg
      className={`scena-editor__shape scena-editor__shape--${cfg.variant}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {geometry}
    </svg>
  );
}
