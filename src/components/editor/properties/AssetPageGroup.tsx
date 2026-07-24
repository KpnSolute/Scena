// Asset-page element controls: an Asset picker (sets the top-level
// SceneElement.asset_id) plus the page number within that multi-page
// Asset, and the shared media framing controls.
import type { AssetSummary } from "../../../services/scena-api/assets";
import type { SceneElement } from "../../../services/scena-api/boards";
import { readAssetPageConfig } from "../../../services/scena-api/boards";
import { AssetPicker } from "./AssetPicker";
import { MediaGroup } from "./MediaGroup";
import { NumberField } from "./shared";

export interface AssetPageGroupProps {
  element: SceneElement;
  assets: AssetSummary[] | null;
  assetsError?: unknown;
  previewUrls?: ReadonlyMap<string, string>;
  onChange: (patch: Partial<SceneElement>) => void;
  updateConfig: (patch: Record<string, unknown>) => void;
}

export function AssetPageGroup({ element, assets, assetsError, previewUrls, onChange, updateConfig }: AssetPageGroupProps) {
  const config = readAssetPageConfig(element);
  return (
    <>
      <div className="scena-editor__prop-group">
        <h4>Asset page</h4>
        <AssetPicker
          assets={assets}
          assetsError={assetsError}
          previewUrls={previewUrls}
          selectedAssetId={element.asset_id}
          onSelect={(assetId) => onChange({ asset_id: assetId })}
          emptyDescription="Upload a PDF or PowerPoint to page through it here."
        />
        <NumberField
          label="Page number"
          hint="1-based page within a multi-page Asset."
          value={config.page_number}
          min={1}
          max={10000}
          step={1}
          onCommit={(value) => updateConfig({ page_number: value })}
        />
      </div>
      <MediaGroup media={config} updateConfig={updateConfig} />
    </>
  );
}
