// Media framing controls shared by image / asset_page / carousel / video.
import type { MediaConfig, ObjectFit } from "../../../services/scena-api/boards";
import { OBJECT_FITS } from "../../../services/scena-api/boards";
import { Field } from "../../ui/Field";
import { Input } from "../../ui/Input";
import { FieldGroup, Segmented, NumberField } from "./shared";

const FIT_LABELS: Record<ObjectFit, string> = { contain: "Contain", cover: "Cover", fill: "Fill" };

export interface MediaGroupProps {
  media: MediaConfig;
  updateConfig: (patch: Record<string, unknown>) => void;
}

export function MediaGroup({ media, updateConfig }: MediaGroupProps) {
  return (
    <div className="scena-editor__prop-group">
      <h4>Media</h4>
      <FieldGroup label="Fit">
        <Segmented
          aria-label="Object fit"
          value={media.fit}
          options={OBJECT_FITS.map((fit) => ({ value: fit, label: FIT_LABELS[fit] }))}
          onChange={(value) => updateConfig({ fit: value })}
        />
      </FieldGroup>
      <NumberField label="Corner radius" value={media.corner_radius} min={0} max={400} step={1} onCommit={(value) => updateConfig({ corner_radius: value })} />
      <Field label="Alt text" hint="Describes the image for accessibility.">
        <Input value={media.alt} onChange={(event) => updateConfig({ alt: event.target.value })} />
      </Field>
    </div>
  );
}
