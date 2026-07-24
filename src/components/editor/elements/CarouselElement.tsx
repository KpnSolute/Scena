import { useEffect, useState, type CSSProperties } from "react";
import { readCarouselConfig } from "../../../services/scena-api/boards";
import { getAssetPreview } from "../../../services/scena-api/assets";
import { MediaPlaceholder, MediaSkeleton } from "./shared";
import type { ElementRendererProps } from "./types";

type SlideState = { status: "loading" } | { status: "ready"; url: string } | { status: "error" };

/** Resolves every configured Asset up front (so slides transition instantly
 * once loaded, no per-slide pop-in), preferring the board page's warm cache
 * and falling back to a signed-read fetch. Cancels in-flight fetches when
 * the id list changes or the component unmounts. */
function useCarouselSlides(assetIds: readonly string[], presetUrls: ReadonlyMap<string, string> | undefined): Map<string, SlideState> {
  const key = assetIds.join(",");
  const [slides, setSlides] = useState<Map<string, SlideState>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setSlides(new Map(assetIds.map((id) => {
      const preset = presetUrls?.get(id);
      const initial: SlideState = preset ? { status: "ready", url: preset } : { status: "loading" };
      return [id, initial] as const;
    })));

    assetIds
      .filter((id) => !presetUrls?.get(id))
      .forEach((id) => {
        getAssetPreview(id, { preference: "full", signal: controller.signal })
          .then((preview) => {
            if (!cancelled) setSlides((prev) => new Map(prev).set(id, { status: "ready", url: preview.signed_url }));
          })
          .catch((error: unknown) => {
            if (cancelled) return;
            if (error instanceof DOMException && error.name === "AbortError") return;
            setSlides((prev) => new Map(prev).set(id, { status: "error" }));
          });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the join of assetIds, the real dependency
  }, [key, presetUrls]);

  return slides;
}

export function CarouselElement({ element, assetUrls, scale }: ElementRendererProps) {
  const config = readCarouselConfig(element);
  const slides = useCarouselSlides(config.asset_ids, assetUrls);
  const [index, setIndex] = useState(0);

  const idsKey = config.asset_ids.join(",");
  useEffect(() => setIndex(0), [idsKey]);

  useEffect(() => {
    if (config.asset_ids.length < 2) return;
    const id = window.setInterval(() => setIndex((current) => (current + 1) % config.asset_ids.length), config.interval_ms);
    return () => window.clearInterval(id);
  }, [idsKey, config.interval_ms, config.asset_ids.length]);

  const frameStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    position: "relative",
    borderRadius: `${Math.max(0, config.corner_radius * scale)}px`,
    overflow: "hidden",
  };

  if (config.asset_ids.length === 0) {
    return <MediaPlaceholder message="Add images to the carousel" style={frameStyle} />;
  }

  const currentId = config.asset_ids[index];
  const current = slides.get(currentId);
  const transitionClass = config.transition !== "none" ? `scena-editor__renderer-carousel-slide--${config.transition}` : "";

  return (
    <div className="scena-editor__renderer-carousel" style={frameStyle}>
      {!current || current.status === "loading" ? (
        <MediaSkeleton />
      ) : current.status === "error" ? (
        <MediaPlaceholder message="Couldn't load this slide" tone="error" />
      ) : (
        <img
          key={currentId}
          className={["scena-editor__renderer-carousel-slide", transitionClass].filter(Boolean).join(" ")}
          src={current.url}
          alt={config.alt || "Carousel slide"}
          draggable={false}
          style={{ objectFit: config.fit }}
        />
      )}
      {config.asset_ids.length > 1 && (
        <span className="scena-editor__renderer-carousel-dots" aria-label={`Slide ${index + 1} of ${config.asset_ids.length}`}>
          {config.asset_ids.map((id, dotIndex) => (
            <i key={id} className={dotIndex === index ? "is-active" : ""} />
          ))}
        </span>
      )}
    </div>
  );
}
