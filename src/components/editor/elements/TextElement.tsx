import { readTextStyle } from "../../../services/scena-api/boards";
import { stringValue, textFrameStyle, textRunStyle } from "./shared";
import type { ElementRendererProps } from "./types";

export function TextElement({ element, scale }: ElementRendererProps) {
  const style = readTextStyle(element);
  const text = stringValue(element.config.text, "");

  return (
    <div className="scena-editor__renderer-frame" style={textFrameStyle(style)}>
      <span className="scena-editor__renderer-text" style={textRunStyle(style, scale)}>
        {text || "Text"}
      </span>
    </div>
  );
}
