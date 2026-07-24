import type { CSSProperties } from "react";
import { readAssetPageConfig, readMediaConfig } from "../../../services/scena-api/boards";
import { MediaPlaceholder, MediaSkeleton, useAssetPreview } from "./shared";
import type { ElementRendererProps } from "./types";

// Handles both `image` (a single Asset by element.asset_id) and `asset_page`
// (one page of a multi-page Asset — PDF/PowerPoint — addressed by
// asset_page_id / config.page_number). Both share MediaConfig (fit, corner
// radius, alt) — asset_page additionally reads page_number.
export function MediaElement({ element, assetUrl, scale }: ElementRendererProps) {
  const isPage = element.element_type === "asset_page";
  const pageConfig = isPage ? readAssetPageConfig(element) : null;
  const media = pageConfig ?? readMediaConfig(element);

  const state = useAssetPreview(element.asset_id, assetUrl, {
    pageId: element.asset_page_id,
    pageNumber: pageConfig?.page_number,
  });

  const frameStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    borderRadius: `${Math.max(0, media.corner_radius * scale)}px`,
    overflow: "hidden",
  };

  if (state.status === "empty") {
    return <MediaPlaceholder message={isPage ? "No page selected" : "No asset selected"} style={frameStyle} />;
  }
  if (state.status === "loading") {
    return <MediaSkeleton style={frameStyle} />;
  }
  if (state.status === "error") {
    return <MediaPlaceholder message="Couldn't load this asset" tone="error" style={frameStyle} />;
  }

  return (
    <div style={frameStyle}>
      <img
        className="scena-editor__renderer-image"
        src={state.url}
        alt={media.alt}
        draggable={false}
        style={{ objectFit: media.fit }}
      />
    </div>
  );
}
