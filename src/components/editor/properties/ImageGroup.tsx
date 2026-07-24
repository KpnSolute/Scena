// Image element controls: an Asset picker that sets the top-level
// SceneElement.asset_id, plus the shared media framing controls.
import type { AssetSummary } from "../../../services/scena-api/assets";
import type { SceneElement } from "../../../services/scena-api/boards";
import { readMediaConfig } from "../../../services/scena-api/boards";
import { AssetPicker } from "./AssetPicker";
import { MediaGroup } from "./MediaGroup";

export interface ImageGroupProps {
  element: SceneElement;
  assets: AssetSummary[] | null;
  assetsError?: unknown;
  previewUrls?: ReadonlyMap<string, string>;
  onChange: (patch: Partial<SceneElement>) => void;
  updateConfig: (patch: Record<string, unknown>) => void;
}

export function ImageGroup({ element, assets, assetsError, previewUrls, onChange, updateConfig }: ImageGroupProps) {
  return (
    <>
      <div className="scena-editor__prop-group">
        <h4>Image</h4>
        <AssetPicker
          assets={assets}
          assetsError={assetsError}
          previewUrls={previewUrls}
          selectedAssetId={element.asset_id}
          onSelect={(assetId) => onChange({ asset_id: assetId })}
        />
      </div>
      <MediaGroup media={readMediaConfig(element)} updateConfig={updateConfig} />
    </>
  );
}
