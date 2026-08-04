// Canva-style editor chrome: top bar, left icon rail with slide-out panel
// drawer, and bottom bar. Purely presentational — every piece of data and
// every behavior arrives via props, so the same shell drives both the real
// Board editor (/app/boards/:boardId) and the auth-free internal preview
// (/dev/editor). No manager context, no API calls in this file.
import { useCallback, useEffect, useState } from "react";
import type { ReactNode, RefObject } from "react";
import {
  House, ArrowCounterClockwise, ArrowClockwise, ClockCounterClockwise,
  CheckCircle, CircleNotch, WarningCircle,
  SquaresFour, TextT, UploadSimple, Layout, PaintBrushBroad, Crown, CaretDoubleLeft,
  MagnifyingGlassMinus, MagnifyingGlassPlus, FilmStrip, CornersOut, CornersIn,
} from "@phosphor-icons/react";
import { IconButton, Button } from "../ui/Button";
import type { SaveState } from "../../pages/boards/useBoardEditor";

/* ------------------------------------------------------------------ */
/* Top bar                                                            */
/* ------------------------------------------------------------------ */

const SAVE_LABEL: Record<SaveState, { text: string; icon: ReactNode }> = {
  loading: { text: "Loading…", icon: <CircleNotch size={14} className="scena-spinner-icon" /> },
  idle: { text: "Saved", icon: <CheckCircle size={14} /> },
  unsaved: { text: "Unsaved changes", icon: null },
  saving: { text: "Saving…", icon: <CircleNotch size={14} className="scena-spinner-icon" /> },
  saved: { text: "Saved", icon: <CheckCircle size={14} /> },
  failed: { text: "Save failed", icon: <WarningCircle size={14} weight="fill" /> },
  conflict: { text: "Changed elsewhere", icon: <WarningCircle size={14} weight="fill" /> },
};

export interface EditorTopBarProps {
  name: string;
  onRename: (name: string) => void;
  /** Navigate back to the Boards list (real page passes navigate("/app/boards")). */
  onNavigateHome: () => void;
  saveState: SaveState;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canvasWidth: number;
  canvasHeight: number;
  /** Omit to hide the Revisions button (e.g. in the demo preview). */
  onOpenRevisions?: () => void;
  /** Omit to hide the Save button. Disabled/loading states derive from saveState. */
  onSave?: () => void;
}

export function EditorTopBar({
  name, onRename, onNavigateHome, saveState, canUndo, canRedo, onUndo, onRedo,
  canvasWidth, canvasHeight, onOpenRevisions, onSave,
}: EditorTopBarProps) {
  const label = SAVE_LABEL[saveState];
  return (
    <header className="scena-editor__topbar">
      <div className="scena-editor__topbar-group">
        <IconButton icon={<House size={18} />} label="Back to Boards" onClick={onNavigateHome} />
        <input
          className="scena-editor__name-input"
          value={name}
          onChange={(event) => onRename(event.target.value)}
          aria-label="Board name"
        />
        <IconButton icon={<ArrowCounterClockwise size={18} />} label="Undo" disabled={!canUndo} onClick={onUndo} size="sm" />
        <IconButton icon={<ArrowClockwise size={18} />} label="Redo" disabled={!canRedo} onClick={onRedo} size="sm" />
        <span
          className={`scena-editor__save-state${saveState === "saved" || saveState === "idle" ? " scena-editor__save-state--saved" : ""}${saveState === "failed" || saveState === "conflict" ? " scena-editor__save-state--conflict" : ""}`}
        >
          {label.icon}
          {label.text}
        </span>
      </div>

      <div className="scena-editor__spacer" />

      <span className="scena-editor__topbar-dims">{canvasWidth} × {canvasHeight}</span>

      <div className="scena-editor__topbar-group">
        {onOpenRevisions && (
          <Button variant="ghost" size="sm" icon={<ClockCounterClockwise size={16} />} onClick={onOpenRevisions}>
            Revisions
          </Button>
        )}
        {onSave && (
          <Button
            variant="primary"
            size="sm"
            onClick={onSave}
            loading={saveState === "saving"}
            disabled={saveState !== "unsaved"}
          >
            Save
          </Button>
        )}
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Left icon rail + slide-out panel drawer                            */
/* ------------------------------------------------------------------ */

export type EditorRailItemKey = "elements" | "text" | "uploads" | "templates" | "brand";

const RAIL_ITEMS: { key: EditorRailItemKey; label: string; icon: ReactNode; premium?: boolean }[] = [
  { key: "elements", label: "Elements", icon: <SquaresFour size={22} /> },
  { key: "text", label: "Text", icon: <TextT size={22} /> },
  { key: "uploads", label: "Uploads", icon: <UploadSimple size={22} /> },
  { key: "templates", label: "Templates", icon: <Layout size={22} /> },
  { key: "brand", label: "Brand", icon: <PaintBrushBroad size={22} /> },
];

const RAIL_LABELS: Record<EditorRailItemKey, string> = {
  elements: "Elements",
  text: "Text",
  uploads: "Uploads",
  templates: "Templates",
  brand: "Brand",
};

export interface EditorRailProps {
  active: EditorRailItemKey | null;
  /** Called with the clicked item's key — parent toggles (same key → collapse). */
  onToggle: (key: EditorRailItemKey) => void;
  /** Drawer content for the active item; drawer renders only when active is set. */
  children?: ReactNode;
}

export function EditorRail({ active, onToggle, children }: EditorRailProps) {
  return (
    <>
      <nav className="scena-editor__rail" aria-label="Editor panels">
        {RAIL_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`scena-editor__rail-item${active === item.key ? " scena-editor__rail-item--active" : ""}`}
            aria-pressed={active === item.key}
            onClick={() => onToggle(item.key)}
          >
            {item.premium && <Crown size={12} weight="fill" className="scena-editor__rail-crown" aria-label="Premium" />}
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      {active && (
        <aside className="scena-editor__drawer">
          <div className="scena-editor__drawer-header">
            <h3>{RAIL_LABELS[active]}</h3>
            <IconButton icon={<CaretDoubleLeft size={16} />} label="Close panel" size="sm" onClick={() => onToggle(active)} />
          </div>
          <div className="scena-editor__drawer-body">{children}</div>
        </aside>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom bar                                                         */
/* ------------------------------------------------------------------ */

export interface EditorBottomBarProps {
  sceneIndex: number; // 1-based position of the selected scene
  sceneCount: number;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  scenesVisible: boolean;
  onToggleScenes: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  /** When false the fullscreen toggle is hidden (Fullscreen API unavailable). */
  fullscreenSupported: boolean;
}

const ZOOM_MIN = 25;
const ZOOM_MAX = 200;

export function EditorBottomBar({
  sceneIndex, sceneCount, zoom, onZoomChange, scenesVisible, onToggleScenes,
  isFullscreen, onToggleFullscreen, fullscreenSupported,
}: EditorBottomBarProps) {
  return (
    <footer className="scena-editor__bottombar">
      <span className="scena-editor__bottombar-scenes-label">
        Scene {Math.max(1, sceneIndex)} / {Math.max(1, sceneCount)}
      </span>

      <div className="scena-editor__spacer" />

      <div className="scena-editor__zoom">
        <IconButton icon={<MagnifyingGlassMinus size={16} />} label="Zoom out" size="sm" onClick={() => onZoomChange(Math.max(ZOOM_MIN, zoom - 25))} />
        <input
          type="range"
          className="scena-editor__zoom-slider"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={5}
          value={zoom}
          onChange={(event) => onZoomChange(Number(event.target.value))}
          aria-label="Zoom"
        />
        <IconButton icon={<MagnifyingGlassPlus size={16} />} label="Zoom in" size="sm" onClick={() => onZoomChange(Math.min(ZOOM_MAX, zoom + 25))} />
        <span className="scena-editor__zoom-value">{zoom}%</span>
      </div>

      <Button
        variant={scenesVisible ? "secondary" : "ghost"}
        size="sm"
        icon={<FilmStrip size={16} />}
        aria-pressed={scenesVisible}
        onClick={onToggleScenes}
      >
        Scenes
      </Button>

      {fullscreenSupported && (
        <IconButton
          icon={isFullscreen ? <CornersIn size={18} /> : <CornersOut size={18} />}
          label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={onToggleFullscreen}
        />
      )}
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Fullscreen helper                                                  */
/* ------------------------------------------------------------------ */

/** Fullscreen API wrapper for the editor root. Degrades gracefully:
 *  `supported` is false where the API is missing, and toggle failures
 *  (e.g. permission denied) are swallowed. */
export function useEditorFullscreen(ref: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const supported =
    typeof document !== "undefined" &&
    typeof document.exitFullscreen === "function" &&
    typeof Element !== "undefined" &&
    typeof Element.prototype.requestFullscreen === "function" &&
    document.fullscreenEnabled !== false;

  useEffect(() => {
    function onChange() {
      setIsFullscreen(document.fullscreenElement != null);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(() => {
    if (!supported) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (ref.current) {
      ref.current.requestFullscreen().catch(() => {});
    }
  }, [ref, supported]);

  const exit = useCallback(() => {
    if (supported && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [supported]);

  return { isFullscreen, supported, toggle, exit };
}
