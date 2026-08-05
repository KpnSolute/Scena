import { Broadcast, Check } from "@phosphor-icons/react";
import type { BoardSummary } from "../../services/scena-api/boards";

export function BoardChoiceGrid({ label, hint, boards, value, onChange }: {
  label: string;
  hint: string;
  boards: BoardSummary[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="scena-session-board-picker">
      <legend>{label}</legend>
      <p>{hint}</p>
      <div className="scena-session-board-picker__grid">
        {boards.map((board) => {
          const selected = board.id === value;
          return (
            <button
              key={board.id}
              type="button"
              className="scena-session-board-choice"
              data-selected={selected}
              aria-pressed={selected}
              onClick={() => onChange(board.id)}
            >
              <span className="scena-session-board-choice__preview" style={{ background: board.background_color }}>
                <Broadcast size={22} weight="duotone" />
              </span>
              <span className="scena-session-board-choice__copy">
                <strong>{board.name}</strong>
                <small>{board.canvas_width} × {board.canvas_height} · v{board.version}</small>
              </span>
              <span className="scena-session-board-choice__check" aria-hidden="true"><Check size={14} weight="bold" /></span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
