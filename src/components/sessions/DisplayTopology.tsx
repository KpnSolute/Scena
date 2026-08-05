import { useRef, useState } from "react";
import { ArrowsOutCardinal, GridFour, Monitor, Rows, Stack, SquaresFour } from "@phosphor-icons/react";
import type { SessionScreen } from "../../domain/sessions";
import type { BoardSummary } from "../../services/scena-api/boards";
import { clampViewport, topologyPreset, type DisplayViewport, type TopologyPreset } from "../../domain/displayTopology";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";

interface Props {
  screens: SessionScreen[];
  screenNames: ReadonlyMap<string, string>;
  boards: BoardSummary[];
  fallbackBoardId: string | null;
  disabled?: boolean;
  onViewport: (screenId: string, viewport: DisplayViewport) => void;
  onBoard: (screenId: string, boardId: string | null) => void;
}

interface DragState { screenId: string; startX: number; startY: number; origin: DisplayViewport; }

export function DisplayTopology({ screens, screenNames, boards, fallbackBoardId, disabled, onViewport, onBoard }: Props) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [live, setLive] = useState<DisplayViewport | null>(null);
  const [identified, setIdentified] = useState<string | null>(null);

  function viewportOf(screen: SessionScreen): DisplayViewport {
    return { x: screen.viewport_x_percent, y: screen.viewport_y_percent, width: screen.viewport_width_percent, height: screen.viewport_height_percent };
  }

  function beginDrag(screen: SessionScreen, event: React.PointerEvent) {
    if (disabled) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setDrag({ screenId: screen.id, startX: event.clientX, startY: event.clientY, origin: viewportOf(screen) });
  }

  function move(event: React.PointerEvent) {
    if (!drag || !surfaceRef.current) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    setLive(clampViewport({ ...drag.origin, x: drag.origin.x + (event.clientX - drag.startX) / rect.width * 100, y: drag.origin.y + (event.clientY - drag.startY) / rect.height * 100 }));
  }

  function endDrag() {
    if (drag && live) onViewport(drag.screenId, live);
    setDrag(null);
    setLive(null);
  }

  function applyPreset(preset: TopologyPreset) {
    topologyPreset(screens.length, preset).forEach((viewport, index) => onViewport(screens[index].id, viewport));
  }

  return (
    <section className="scena-control-room" aria-label="Live Display control room">
      <header className="scena-control-room__header">
        <div><span className="scena-session-eyebrow">Live control room</span><h2>Display task view</h2><p>Arrange outputs like desktops, identify a screen, then route a Board to it.</p></div>
        <div className="scena-control-room__presets" aria-label="Arrangement presets">
          <Button variant="ghost" size="sm" icon={<Stack size={16} />} onClick={() => applyPreset("duplicate")} disabled={disabled}>Duplicate</Button>
          <Button variant="ghost" size="sm" icon={<Rows size={16} />} onClick={() => applyPreset("horizontal")} disabled={disabled}>Horizontal</Button>
          <Button variant="ghost" size="sm" icon={<SquaresFour size={16} />} onClick={() => applyPreset("vertical")} disabled={disabled}>Stacked</Button>
          <Button variant="ghost" size="sm" icon={<GridFour size={16} />} onClick={() => applyPreset("grid")} disabled={disabled}>Grid</Button>
        </div>
      </header>
      <div ref={surfaceRef} className="scena-control-room__surface" onPointerMove={move} onPointerUp={endDrag}>
        <div className="scena-control-room__surface-grid" aria-hidden="true" />
        {screens.map((screen, index) => {
          const viewport = drag?.screenId === screen.id && live ? live : viewportOf(screen);
          const boardId = screen.board_id ?? "";
          const fallbackBoard = boards.find((board) => board.id === fallbackBoardId);
          return (
            <article key={screen.id} className={`scena-control-room__monitor${identified === screen.id ? " is-identified" : ""}${screen.is_enabled ? "" : " is-disabled"}`} style={{ left: `${viewport.x}%`, top: `${viewport.y}%`, width: `${viewport.width}%`, height: `${viewport.height}%` }}>
              <button type="button" className="scena-control-room__drag" onPointerDown={(event) => beginDrag(screen, event)} aria-label={`Move ${screenNames.get(screen.screen_id) ?? `Display ${index + 1}`}`}>
                <ArrowsOutCardinal size={14} /><span>{index + 1}</span>
              </button>
              <div className="scena-control-room__preview"><Monitor size={26} weight="duotone" /><strong>{screenNames.get(screen.screen_id) ?? `Display ${index + 1}`}</strong><small>{screen.is_primary ? "Primary output" : "Output"}</small></div>
              <div className="scena-control-room__flyout">
                <Select aria-label={`Board for ${screenNames.get(screen.screen_id) ?? `Display ${index + 1}`}`} value={boardId} disabled={disabled} onChange={(event) => onBoard(screen.id, event.target.value || null)} options={[{ value: "", label: fallbackBoard ? `Session Board · ${fallbackBoard.name}` : "Session Board" }, ...boards.filter((board) => board.status === "active").map((board) => ({ value: board.id, label: board.name }))]} />
                <Button variant="secondary" size="sm" onClick={() => { setIdentified(screen.id); window.setTimeout(() => setIdentified(null), 2500); }}>Identify</Button>
              </div>
            </article>
          );
        })}
        {screens.length === 0 && <div className="scena-control-room__empty"><Monitor size={32} /><strong>Add a Display to begin routing.</strong></div>}
      </div>
      <div className="scena-control-room__dock"><span>BOARDS</span>{boards.filter((board) => board.status === "active").map((board) => <div key={board.id} title="Choose this Board from a Display flyout"><BroadcastGlyph /><strong>{board.name}</strong><small>{board.canvas_width}×{board.canvas_height}</small></div>)}</div>
    </section>
  );
}

function BroadcastGlyph() { return <span className="scena-control-room__board-glyph" aria-hidden="true"><span /><span /><span /></span>; }
