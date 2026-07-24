// Carousel element controls: an ordered Asset list (config.asset_ids),
// playback timing/transition, and the shared media framing controls.
import type { AssetSummary } from "../../../services/scena-api/assets";
import type { SceneElement } from "../../../services/scena-api/boards";
import { readCarouselConfig } from "../../../services/scena-api/boards";
import { Field } from "../../ui/Field";
import { Select } from "../../ui/Select";
import { AssetListPicker } from "./AssetPicker";
import { MediaGroup } from "./MediaGroup";
import { NumberField } from "./shared";

const TRANSITION_OPTIONS = [
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Slide" },
  { value: "none", label: "None" },
];

export interface CarouselGroupProps {
  element: SceneElement;
  assets: AssetSummary[] | null;
  assetsError?: unknown;
  previewUrls?: ReadonlyMap<string, string>;
  updateConfig: (patch: Record<string, unknown>) => void;
}

export function CarouselGroup({ element, assets, assetsError, previewUrls, updateConfig }: CarouselGroupProps) {
  const config = readCarouselConfig(element);
  return (
    <>
      <div className="scena-editor__prop-group">
        <h4>Carousel slides</h4>
        <AssetListPicker
          assets={assets}
          assetsError={assetsError}
          previewUrls={previewUrls}
          assetIds={config.asset_ids}
          onChange={(assetIds) => updateConfig({ asset_ids: assetIds })}
        />
      </div>
      <div className="scena-editor__prop-group">
        <h4>Playback</h4>
        <NumberField
          label="Seconds per slide"
          value={Math.round(config.interval_ms / 1000)}
          min={1}
          max={600}
          step={1}
          onCommit={(value) => updateConfig({ interval_ms: value * 1000 })}
        />
        <Field label="Transition">
          <Select aria-label="Transition" value={config.transition} options={TRANSITION_OPTIONS} onChange={(event) => updateConfig({ transition: event.target.value })} />
        </Field>
      </div>
      <MediaGroup media={config} updateConfig={updateConfig} />
    </>
  );
}
