import { MusicNotes } from "@phosphor-icons/react";
import { readMusicPlayerConfig } from "../../../services/scena-api/boards";
import { PreviewBadge } from "./shared";
import type { ElementRendererProps } from "./types";

// Audio ingest has no backend yet (SCENA_UI_API_CAPABILITIES.assets.audio is
// false) — there is no track to play or title/artist to show, so this
// renders the configured player chrome only (artwork slot, progress rail,
// accent color) with an explicit "no live data" disclosure.
export function MusicPlayerElement({ element }: ElementRendererProps) {
  const config = readMusicPlayerConfig(element);

  return (
    <div className="scena-editor__renderer-player-preview">
      {config.show_artwork && (
        <span className="scena-editor__renderer-player-artwork" style={{ background: config.accent }} aria-hidden="true">
          <MusicNotes size={18} />
        </span>
      )}
      <div className="scena-editor__renderer-player-preview-body">
        <span className="scena-editor__renderer-player-preview-title">No track configured</span>
        {config.show_progress && (
          <span className="scena-editor__renderer-player-progress">
            <i style={{ background: config.accent }} />
          </span>
        )}
        <PreviewBadge />
      </div>
    </div>
  );
}
