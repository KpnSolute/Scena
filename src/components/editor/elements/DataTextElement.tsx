import { readDataTextConfig } from "../../../services/scena-api/boards";
import { PreviewBadge, textFrameStyle, textRunStyle } from "./shared";
import type { ElementRendererProps } from "./types";

// data_text has no live payload to bind to yet — it previews exactly what
// will be shown once a source_key resolves: prefix + the key (or the
// configured fallback when unset) + suffix. Never an invented number.
export function DataTextElement({ element, scale }: ElementRendererProps) {
  const config = readDataTextConfig(element);
  const isResolved = config.resolved_value !== null;
  const token = isResolved ? String(config.resolved_value) : config.source_key ? `{${config.source_key}}` : config.fallback;
  const preview = `${config.prefix}${token}${config.suffix}`;

  return (
    <div className="scena-editor__renderer-frame scena-editor__renderer-frame--column" style={textFrameStyle(config)}>
      <span className="scena-editor__renderer-data-text" style={textRunStyle(config, scale)}>{preview}</span>
      {!isResolved && <PreviewBadge />}
    </div>
  );
}
