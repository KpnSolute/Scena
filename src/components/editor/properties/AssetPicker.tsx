// Asset picker used by image / asset_page (single select, sets the
// top-level SceneElement.asset_id) and carousel (ordered multi-select,
// manages config.asset_ids). Handles loading, empty, and error states
// honestly instead of collapsing an error into "no Assets".
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ImageSquare, ArrowUp, ArrowDown, Trash } from "@phosphor-icons/react";
import type { AssetSummary } from "../../../services/scena-api/assets";
import { Skeleton } from "../../ui/Skeleton";
import { EmptyState } from "../../ui/EmptyState";
import { ErrorBanner } from "../../ui/ErrorBanner";
import { IconButton } from "../../ui/Button";

export interface AssetPickerProps {
  /** null = still loading (skeletons); [] = empty state. */
  assets: AssetSummary[] | null;
  assetsError?: unknown;
  previewUrls?: ReadonlyMap<string, string>;
  selectedAssetId: string | null;
  onSelect: (assetId: string | null) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function AssetPicker({
  assets,
  assetsError,
  previewUrls,
  selectedAssetId,
  onSelect,
  emptyTitle = "No ready Assets",
  emptyDescription = "Upload an image, PDF, or PowerPoint first.",
}: AssetPickerProps) {
  if (assets === null) {
    return (
      <div style={{ display: "grid", gap: 8 }}>
        <Skeleton height={44} />
        <Skeleton height={44} />
      </div>
    );
  }
  if (assetsError && assets.length === 0) {
    return <ErrorBanner error={assetsError} title="Couldn't load Assets" />;
  }
  if (assets.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={
          <Link to="/app/assets" className="scena-btn scena-btn--secondary scena-btn--sm">
            Go to Assets
          </Link>
        }
      />
    );
  }
  return (
    <div role="group" aria-label="Choose an Asset">
      {assets.map((asset) => {
        const selected = asset.id === selectedAssetId;
        return (
          <button
            key={asset.id}
            type="button"
            className="scena-editor__asset-tile"
            aria-pressed={selected}
            style={selected ? { borderColor: "var(--scena-violet)", boxShadow: "inset 0 0 0 1px var(--scena-violet)" } : undefined}
            onClick={() => onSelect(selected ? null : asset.id)}
          >
            {previewUrls?.get(asset.id) ? (
              <img src={previewUrls.get(asset.id)} alt="" />
            ) : (
              <span className="scena-editor__asset-tile-fallback">
                <ImageSquare size={18} />
              </span>
            )}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.original_filename}</span>
          </button>
        );
      })}
    </div>
  );
}

export interface AssetListPickerProps {
  assets: AssetSummary[] | null;
  assetsError?: unknown;
  previewUrls?: ReadonlyMap<string, string>;
  assetIds: string[];
  onChange: (assetIds: string[]) => void;
}

/** Ordered multi-select for carousel.config.asset_ids: reorder/remove the
 * current slides, then pick more from the remaining ready Assets. */
export function AssetListPicker({ assets, assetsError, previewUrls, assetIds, onChange }: AssetListPickerProps) {
  const byId = useMemo(() => new Map((assets ?? []).map((asset) => [asset.id, asset] as const)), [assets]);
  const availableAssets = useMemo(
    () => (assets ? assets.filter((asset) => !assetIds.includes(asset.id)) : assets),
    [assets, assetIds],
  );
  const noneUploadedYet = (assets ?? []).length === 0;

  function move(index: number, direction: -1 | 1) {
    const next = [...assetIds];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  function remove(index: number) {
    onChange(assetIds.filter((_, i) => i !== index));
  }
  function add(assetId: string) {
    if (assetIds.includes(assetId)) return;
    onChange([...assetIds, assetId]);
  }

  return (
    <div>
      {assetIds.length > 0 && (
        <ol style={{ listStyle: "none", padding: 0, margin: "0 0 12px", display: "grid", gap: 8 }}>
          {assetIds.map((id, index) => {
            const asset = byId.get(id);
            return (
              <li
                key={`${id}-${index}`}
                className="scena-editor__asset-tile"
                style={{ cursor: "default", gridTemplateColumns: "48px minmax(0, 1fr) auto" }}
              >
                {previewUrls?.get(id) ? (
                  <img src={previewUrls.get(id)} alt="" />
                ) : (
                  <span className="scena-editor__asset-tile-fallback">
                    <ImageSquare size={18} />
                  </span>
                )}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {asset?.original_filename ?? "Removed Asset"}
                </span>
                <span style={{ display: "flex", gap: 2 }}>
                  <IconButton icon={<ArrowUp size={14} />} label={`Move slide ${index + 1} earlier`} size="sm" onClick={() => move(index, -1)} disabled={index === 0} />
                  <IconButton icon={<ArrowDown size={14} />} label={`Move slide ${index + 1} later`} size="sm" onClick={() => move(index, 1)} disabled={index === assetIds.length - 1} />
                  <IconButton icon={<Trash size={14} />} label={`Remove slide ${index + 1}`} size="sm" onClick={() => remove(index)} />
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <p className="scena-field__hint" style={{ marginBottom: 8 }}>
        Add Assets to the carousel
      </p>
      <AssetPicker
        assets={availableAssets}
        assetsError={assetsError}
        previewUrls={previewUrls}
        selectedAssetId={null}
        onSelect={(assetId) => assetId && add(assetId)}
        emptyTitle={noneUploadedYet ? undefined : "All ready Assets are added"}
        emptyDescription={noneUploadedYet ? undefined : "Every ready Asset in this Workspace is already in the carousel."}
      />
    </div>
  );
}
