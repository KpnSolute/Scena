// Video element controls: playback flags plus the shared media framing
// controls. No Asset picker here — SCENA_UI_API_CAPABILITIES.assets.video
// is false, so there is no video ingest path to attach a real source to
// yet (see the disclosure note below).
import type { SceneElement } from "../../../services/scena-api/boards";
import { readVideoConfig } from "../../../services/scena-api/boards";
import { Checkbox } from "../../ui/Checkbox";
import { NoDataSourceNote } from "./shared";
import { MediaGroup } from "./MediaGroup";

export interface VideoGroupProps {
  element: SceneElement;
  updateConfig: (patch: Record<string, unknown>) => void;
}

export function VideoGroup({ element, updateConfig }: VideoGroupProps) {
  const video = readVideoConfig(element);
  return (
    <>
      <div className="scena-editor__prop-group">
        <h4>Video</h4>
        <NoDataSourceNote>
          Scena doesn&apos;t accept video uploads yet, so this element has no source to play. These settings configure the preview player for when it does.
        </NoDataSourceNote>
        <Checkbox label="Loop" checked={video.loop} onChange={(event) => updateConfig({ loop: event.target.checked })} />
        <Checkbox label="Muted" checked={video.muted} onChange={(event) => updateConfig({ muted: event.target.checked })} />
        <Checkbox label="Autoplay" checked={video.autoplay} onChange={(event) => updateConfig({ autoplay: event.target.checked })} />
      </div>
      <MediaGroup media={video} updateConfig={updateConfig} />
    </>
  );
}
