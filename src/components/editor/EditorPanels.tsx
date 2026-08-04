// Drawer panel contents for the editor's left rail. All presentational:
// data arrives via props (the real page fetches Assets; the /dev/editor
// preview passes an empty list), so these can render without auth.
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  TextT, ImageSquare, Shapes, FileText, QrCode, Clock, CalendarBlank, Timer,
  Megaphone, MusicNotes, VideoCamera, CloudSun, TextAa, Rows, Crown, Smiley,
  MagnifyingGlass, FilmStrip,
} from "@phosphor-icons/react";
import { SCENA_UI_API_CAPABILITIES } from "../../services/scena-api/capabilities";
import type { AssetSummary } from "../../services/scena-api/assets";
import type { ElementType, ShapeVariant } from "../../services/scena-api/boards";
import { Skeleton } from "../ui/Skeleton";
import { EmptyState } from "../ui/EmptyState";
import { SHAPE_VARIANTS, SHAPE_VARIANT_ICONS, SHAPE_VARIANT_LABELS } from "./shapeVariants";
import { BRAND_PRESETS, STUDIO_TEMPLATES, type BrandPreset, type StudioTemplateId } from "./studioPresets";

/* ------------------------------------------------------------------ */
/* Elements                                                           */
/* ------------------------------------------------------------------ */

const ELEMENT_ICONS: Record<ElementType, ReactNode> = {
  text: <TextT size={20} />,
  image: <ImageSquare size={20} />,
  shape: <Shapes size={20} />,
  asset_page: <FileText size={20} />,
  qr_static: <QrCode size={20} />,
  qr_dynamic: <QrCode size={20} />,
  clock: <Clock size={20} />,
  date: <CalendarBlank size={20} />,
  countdown: <Timer size={20} />,
  ticker: <Megaphone size={20} />,
  music_player: <MusicNotes size={20} />,
  carousel: <Rows size={20} />,
  video: <VideoCamera size={20} />,
  weather: <CloudSun size={20} />,
  data_text: <TextAa size={20} />,
};

const ELEMENT_LABELS: Record<ElementType, string> = {
  text: "Text",
  image: "Image",
  shape: "Shape",
  asset_page: "Asset",
  qr_static: "QR code",
  qr_dynamic: "Connected QR",
  clock: "Clock",
  date: "Date",
  countdown: "Countdown",
  ticker: "Ticker",
  music_player: "Music preview",
  carousel: "Asset rotation",
  video: "Video preview",
  weather: "Weather",
  data_text: "Connected text",
};

const ELEMENT_DESCRIPTIONS: Record<ElementType, string> = {
  text: "Headings, menu items, prices, and notes",
  image: "Place an image or local graphic",
  shape: "Backgrounds, dividers, and accents",
  asset_page: "A ready image, PDF page, or PowerPoint slide",
  qr_static: "Link guests to a menu, order page, or survey",
  qr_dynamic: "A redirect target you can change later",
  clock: "Current time for this display",
  date: "Current date for this display",
  countdown: "Count down to an event or service change",
  ticker: "A scrolling announcement",
  music_player: "Designed player state; playback is not connected",
  carousel: "Rotate through ready workspace Assets",
  video: "Designed video state; playback is not connected",
  weather: "Designed weather state; a source is not connected",
  data_text: "A future value from an API or webhook field",
};

const READY_WIDGETS: readonly ElementType[] = ["clock", "date", "countdown", "ticker", "carousel", "qr_dynamic"];
const CONNECTION_PREVIEWS: readonly ElementType[] = ["data_text", "weather", "video", "music_player"];

interface MenuStarter {
  id: string;
  label: string;
  description: string;
  config: Record<string, unknown>;
}

const MENU_STARTERS: readonly MenuStarter[] = [
  { id: "menu-title", label: "Menu title", description: "Large display heading", config: { text: "Today’s Menu", font_size: 72, font_weight: 800, font_family: "display", align: "center" } },
  { id: "section-heading", label: "Section heading", description: "Breakfast, lunch, drinks…", config: { text: "Lunch", font_size: 44, font_weight: 700, font_family: "display" } },
  { id: "menu-item", label: "Menu item", description: "Dish name and description", config: { text: "Menu item\nShort description", font_size: 30, font_weight: 600, line_height: 1.35 } },
  { id: "price", label: "Price", description: "Clear right-aligned price", config: { text: "$0.00", font_size: 34, font_weight: 700, align: "right" } },
  { id: "notice", label: "Service notice", description: "Special, sold out, or closing note", config: { text: "Today’s special", font_size: 28, font_weight: 700, align: "center", background: "#5b7cfa" } },
];

export interface ElementsGridPanelProps {
  onAddElement: (type: ElementType) => void;
  /** The single "Shape" tile is a sub-palette — one tile per variant,
   * each inserting a shape preset with that variant set. */
  onAddShape: (variant: ShapeVariant) => void;
  onAddLibraryAsset?: (type: "image" | "text", config: Record<string, unknown>) => void;
}

export function ElementsGridPanel({ onAddElement, onAddShape, onAddLibraryAsset = () => {} }: ElementsGridPanelProps) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const matches = (label: string, description = "") => !normalized || `${label} ${description}`.toLowerCase().includes(normalized);
  const menuStarters = MENU_STARTERS.filter((item) => matches(item.label, item.description));
  const staticTypes = SCENA_UI_API_CAPABILITIES.elements.static.filter((type) => type !== "shape");
  const contentTypes = staticTypes.filter((type) => matches(ELEMENT_LABELS[type], ELEMENT_DESCRIPTIONS[type]));
  const readyWidgets = READY_WIDGETS.filter((type) => matches(ELEMENT_LABELS[type], ELEMENT_DESCRIPTIONS[type]));
  const connectionPreviews = CONNECTION_PREVIEWS.filter((type) => matches(ELEMENT_LABELS[type], ELEMENT_DESCRIPTIONS[type]));
  const shapeVariants = SHAPE_VARIANTS.filter((variant) => matches(SHAPE_VARIANT_LABELS[variant], "shape accent divider background"));
  const hasResults = menuStarters.length + contentTypes.length + readyWidgets.length + connectionPreviews.length + shapeVariants.length > 0;

  function renderElementTile(type: ElementType, availability: "ready" | "setup" = "ready") {
    return (
      <button key={type} type="button" className="scena-editor__element-tile" onClick={() => onAddElement(type)}>
        <span className="scena-editor__element-tile-icon">{ELEMENT_ICONS[type]}</span>
        <span className="scena-editor__element-tile-copy">
          <strong>{ELEMENT_LABELS[type]}</strong>
          <small>{ELEMENT_DESCRIPTIONS[type]}</small>
        </span>
        <span className={`scena-editor__element-status scena-editor__element-status--${availability}`}>
          {availability === "ready" ? "Ready" : "Setup"}
        </span>
      </button>
    );
  }

  return (
    <div className="scena-editor__elements-browser">
      <label className="scena-editor__element-search">
        <MagnifyingGlass size={17} aria-hidden="true" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search content and widgets" aria-label="Search content and widgets" />
      </label>

      {menuStarters.length > 0 && <section className="scena-editor__element-section">
        <div className="scena-editor__element-section-heading">
          <div><h4>Menu board starters</h4><p>Insert styled content, then replace the sample text.</p></div>
          <span>Recommended</span>
        </div>
        <div className="scena-editor__menu-starters">
          {menuStarters.map((item) => (
            <button key={item.id} type="button" className="scena-editor__menu-starter" onClick={() => onAddLibraryAsset("text", item.config)}>
              <TextT size={18} aria-hidden="true" />
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
            </button>
          ))}
        </div>
      </section>}

      {contentTypes.length > 0 && <section className="scena-editor__element-section">
        <div className="scena-editor__element-section-heading"><div><h4>Content</h4><p>Things guests will read, scan, or see.</p></div></div>
        <div className="scena-editor__element-grid">{contentTypes.map((type) => renderElementTile(type))}</div>
      </section>}

      {shapeVariants.length > 0 && <section className="scena-editor__element-section">
      <div className="scena-editor__element-section-heading"><div><h4>Shapes & accents</h4><p>Structure sections and add visual hierarchy.</p></div></div>
      <div className="scena-editor__element-grid" role="group" aria-label="Insert a shape">
        {shapeVariants.map((variant) => (
          <button
            key={variant}
            type="button"
            className="scena-editor__element-tile scena-editor__element-tile--shape"
            onClick={() => onAddShape(variant)}
          >
            <span className="scena-editor__element-tile-icon">{SHAPE_VARIANT_ICONS[variant]}</span>
            <span className="scena-editor__element-tile-copy"><strong>{SHAPE_VARIANT_LABELS[variant]}</strong><small>Design accent</small></span>
          </button>
        ))}
      </div>
      </section>}

      {readyWidgets.length > 0 && <section className="scena-editor__element-section">
        <div className="scena-editor__element-section-heading"><div><h4>Display widgets</h4><p>Content that updates while the Board is showing.</p></div></div>
        <div className="scena-editor__element-grid">{readyWidgets.map((type) => renderElementTile(type))}</div>
      </section>}

      {connectionPreviews.length > 0 && <section className="scena-editor__element-section">
        <div className="scena-editor__element-section-heading"><div><h4>Connections</h4><p>Design the placement now; connect an API or media source later.</p></div></div>
        <div className="scena-editor__element-grid">{connectionPreviews.map((type) => renderElementTile(type, "setup"))}</div>
      </section>}

      {!hasResults && <div className="scena-editor__element-empty"><MagnifyingGlass size={22} /><strong>No matching content</strong><span>Try “menu,” “clock,” “QR,” or “shape.”</span></div>}

      {!normalized && <LibraryPanel onAddLibraryAsset={onAddLibraryAsset} />}
    </div>
  );
}

const LOCAL_EMOJI = ["😀", "🎉", "❤️", "⭐", "👍", "🔥", "🌈", "🎵", "☀️", "✅", "📣", "✨"];

const LOCAL_GIF_LIBRARY = [
  { id: "sparkle", label: "Sparkle", colors: ["#7c3aed", "#22d3ee"] },
  { id: "celebrate", label: "Celebrate", colors: ["#f97316", "#ec4899"] },
  { id: "pulse", label: "Pulse", colors: ["#2563eb", "#14b8a6"] },
  { id: "sunrise", label: "Sunrise", colors: ["#f59e0b", "#ef4444"] },
];

function localLibraryImage(colors: string[]): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient></defs><rect width="320" height="180" rx="18" fill="url(#g)"/><circle cx="82" cy="90" r="28" fill="rgba(255,255,255,.65)"/><circle cx="160" cy="90" r="44" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="7"/><circle cx="246" cy="90" r="22" fill="rgba(255,255,255,.5)"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function LibraryPanel({ onAddLibraryAsset = () => {} }: Pick<ElementsGridPanelProps, "onAddLibraryAsset">) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const gifs = LOCAL_GIF_LIBRARY.filter((item) => !normalized || item.label.toLowerCase().includes(normalized));
  return (
    <section className="scena-editor__library" aria-label="Emoji and GIF library">
      <h4 className="scena-editor__drawer-section-title">Library</h4>
      <label className="scena-editor__library-search">
        <MagnifyingGlass size={16} aria-hidden="true" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search emoji or GIFs" aria-label="Search emoji or GIFs" />
      </label>
      <div className="scena-editor__library-heading"><span><Smiley size={16} /> Emoji</span><small>Local</small></div>
      <div className="scena-editor__emoji-grid">
        {LOCAL_EMOJI.map((emoji) => <button key={emoji} type="button" className="scena-editor__emoji-tile" onClick={() => onAddLibraryAsset("text", { text: emoji })} aria-label={`Insert ${emoji}`}>{emoji}</button>)}
      </div>
      <div className="scena-editor__library-heading"><span><FilmStrip size={16} /> GIFs</span><small>Local library</small></div>
      <div className="scena-editor__gif-grid">
        {gifs.map((item) => <button key={item.id} type="button" className="scena-editor__gif-tile" onClick={() => onAddLibraryAsset("image", { src: localLibraryImage(item.colors), alt: item.label })}>
          <img src={localLibraryImage(item.colors)} alt="" /><span>{item.label}</span>
        </button>)}
      </div>
      {gifs.length === 0 && <p className="scena-editor__library-empty">No local GIFs match that search.</p>}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Text presets                                                       */
/* ------------------------------------------------------------------ */

// Only config.text is rendered/edited today (see PropertiesPanel and
// EditorCanvas), so presets differ by default content and footprint —
// no unrendered config keys are invented here.
export interface TextPresetSpec {
  id: "heading" | "subheading" | "body";
  label: string;
  text: string;
  width: number;
  height: number;
}

export const TEXT_PRESETS: TextPresetSpec[] = [
  { id: "heading", label: "Add a heading", text: "Add a heading", width: 44, height: 12 },
  { id: "subheading", label: "Add a subheading", text: "Add a subheading", width: 36, height: 8 },
  { id: "body", label: "Add a little body text", text: "Add a little body text", width: 30, height: 6 },
];

export interface TextPresetsPanelProps {
  onInsertPreset: (preset: TextPresetSpec) => void;
}

export function TextPresetsPanel({ onInsertPreset }: TextPresetsPanelProps) {
  return (
    <div className="scena-editor__text-presets">
      {TEXT_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className={`scena-editor__text-preset scena-editor__text-preset--${preset.id}`}
          onClick={() => onInsertPreset(preset)}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

export function TemplatesPanel({ onApply }: { onApply: (templateId: StudioTemplateId) => void }) {
  return <div className="scena-editor__preset-list">{STUDIO_TEMPLATES.map((template) => <button key={template.id} type="button" className="scena-editor__template-card" onClick={() => onApply(template.id)}>
    <span className="scena-editor__template-preview" style={{ background: `linear-gradient(135deg, ${template.colors[0]} 0 70%, ${template.colors[1]} 70%)` }} />
    <span><strong>{template.name}</strong><small>{template.description}</small></span>
  </button>)}</div>;
}

export function BrandPanel({ onApply }: { onApply: (brand: BrandPreset) => void }) {
  return <div className="scena-editor__preset-list"><p className="scena-editor__preset-intro">Apply a coordinated palette and font to the selected Scene.</p>{BRAND_PRESETS.map((brand) => <button key={brand.id} type="button" className="scena-editor__brand-card" onClick={() => onApply(brand)}>
    <span className="scena-editor__brand-swatches"><i style={{ background: brand.background }} /><i style={{ background: brand.surface }} /><i style={{ background: brand.accent }} /></span>
    <span><strong>{brand.name}</strong><small>{brand.font === "display" ? "Bricolage Grotesque" : "Instrument Sans"}</small></span>
  </button>)}</div>;
}

/* ------------------------------------------------------------------ */
/* Uploads (workspace Assets)                                         */
/* ------------------------------------------------------------------ */

export interface UploadsPanelProps {
  /** null = still loading (skeletons); [] = empty state. */
  assets: AssetSummary[] | null;
  onInsertAsset: (assetId: string) => void;
  previewUrls?: ReadonlyMap<string, string>;
}

export function UploadsPanel({ assets, previewUrls, onInsertAsset }: UploadsPanelProps) {
  if (assets === null) {
    return (
      <div style={{ display: "grid", gap: 8 }}>
        <Skeleton height={40} />
        <Skeleton height={40} />
        <Skeleton height={40} />
      </div>
    );
  }
  if (assets.length === 0) {
    return <EmptyState title="No ready Assets" description="Upload an Asset first, from the Assets page." />;
  }
  return (
    <div>
      {assets.map((asset) => (
        <button key={asset.id} type="button" className="scena-editor__asset-tile" onClick={() => onInsertAsset(asset.id)}>
          {previewUrls?.get(asset.id) ? <img src={previewUrls.get(asset.id)} alt="" /> : <span className="scena-editor__asset-tile-fallback"><ImageSquare size={18} /></span>}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.original_filename}</span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Premium upsell (Templates / Brand)                                 */
/* ------------------------------------------------------------------ */

const UPSELL_COPY: Record<"templates" | "brand", { title: string; body: string }> = {
  templates: {
    title: "Templates are a premium feature",
    body: "Ready-made Board Templates are coming to paid Workspaces.",
  },
  brand: {
    title: "Brand Kits are a premium feature",
    body: "Brand Kits — your logo, colors, and fonts in one place — are coming to paid Workspaces.",
  },
};

export interface PremiumUpsellPanelProps {
  feature: "templates" | "brand";
}

export function PremiumUpsellPanel({ feature }: PremiumUpsellPanelProps) {
  const copy = UPSELL_COPY[feature];
  return (
    <div className="scena-editor__upsell">
      <Crown size={32} weight="fill" className="scena-editor__upsell-crown" />
      <h4>{copy.title}</h4>
      <p>{copy.body}</p>
      <Link to="/app/billing" className="scena-btn scena-btn--primary scena-btn--sm">View plans</Link>
    </div>
  );
}
