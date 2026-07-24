import type { CSSProperties } from "react";
import { VideoCamera } from "@phosphor-icons/react";
import { readVideoConfig } from "../../../services/scena-api/boards";
import { PreviewBadge } from "./shared";
import type { ElementRendererProps } from "./types";

// Video ingest has no backend yet (SCENA_UI_API_CAPABILITIES.assets.video is
// false) — this renders a configuration preview only, never a fabricated
// video frame.
export function VideoElement({ element, scale }: ElementRendererProps) {
  const config = readVideoConfig(element);
  const frameStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    borderRadius: `${Math.max(0, config.corner_radius * scale)}px`,
    overflow: "hidden",
  };
  const flags = [config.autoplay && "Autoplay", config.loop && "Loop", config.muted && "Muted"].filter(Boolean).join(" · ");

  return (
    <div className="scena-editor__renderer-video-placeholder" style={frameStyle}>
      <VideoCamera size={26} aria-hidden="true" />
      {flags && <small>{flags}</small>}
      <PreviewBadge />
    </div>
  );
}
