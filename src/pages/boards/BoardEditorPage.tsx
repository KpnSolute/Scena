import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Broadcast } from "@phosphor-icons/react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { useBoardEditor } from "./useBoardEditor";
import type { ElementType, SceneElement, BoardScene, ShapeVariant } from "../../services/scena-api/boards";
import { SHAPE_VARIANT_PRESETS, SHAPE_VARIANT_SIZE } from "../../components/editor/shapeVariants";
import { getAsset, listAssets, selectAssetPreviewVariant, signAssetRead } from "../../services/scena-api/assets";
import type { AssetSummary } from "../../services/scena-api/assets";
import {
  EditorTopBar, EditorRail, EditorBottomBar, useEditorFullscreen,
} from "../../components/editor/EditorShell";
import type { EditorRailItemKey } from "../../components/editor/EditorShell";
import {
  ElementsGridPanel, TextPresetsPanel, UploadsPanel, PremiumUpsellPanel,
} from "../../components/editor/EditorPanels";
import type { TextPresetSpec } from "../../components/editor/EditorPanels";
import { EditorCanvas } from "../../components/editor/EditorCanvas";
import { PropertiesPanel } from "../../components/editor/PropertiesPanel";
import { SceneStrip } from "../../components/editor/SceneStrip";
import { RevisionsDrawer } from "../../components/editor/RevisionsDrawer";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Progress";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { useToast } from "../../components/ui/Toast";

const LIVE_ELEMENT_TYPES: ElementType[] = [
  "clock", "date", "countdown", "qr_dynamic", "music_player", "ticker", "carousel", "video", "weather", "data_text",
];

const DEFAULT_SIZE: Record<ElementType, { width: number; height: number }> = {
  text: { width: 30, height: 8 },
  image: { width: 30, height: 30 },
  shape: { width: 20, height: 20 },
  asset_page: { width: 40, height: 40 },
  qr_static: { width: 15, height: 15 },
  qr_dynamic: { width: 15, height: 15 },
  clock: { width: 20, height: 10 },
  date: { width: 20, height: 8 },
  countdown: { width: 25, height: 12 },
  ticker: { width: 100, height: 8 },
  music_player: { width: 30, height: 15 },
  carousel: { width: 40, height: 40 },
  video: { width: 40, height: 30 },
  weather: { width: 20, height: 15 },
  data_text: { width: 25, height: 8 },
};

// Insert-time default config per element type — every type must insert with
// a renderable default, not an empty object. Shape's default (used only if
// an element_type "shape" is ever inserted outside the variant sub-palette,
// e.g. a future generic insert path) mirrors the variant presets in
// shapeVariants.tsx with "rectangle" as the base variant.
function defaultConfigFor(type: ElementType): Record<string, unknown> {
  switch (type) {
    case "text":
      return { text: "Text" };
    case "shape":
      return { variant: "rectangle", fill: "#5b7cfa", fill_opacity: 1, border_width: 0, border_color: "#ffffff", border_style: "solid", corner_radius: 0 };
    default:
      return {};
  }
}

export function BoardEditorPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const [searchParams] = useSearchParams();
  const context = useManagerContext();
  const navigate = useNavigate();
  const toast = useToast();
  const editor = useBoardEditor(boardId!, context.workspace.id);
  const [zoom, setZoom] = useState(100);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<EditorRailItemKey | null>("elements");
  const [scenesVisible, setScenesVisible] = useState(true);
  const [assets, setAssets] = useState<AssetSummary[] | null>(null);
  const liveSessionId = searchParams.get("liveSession");
  const [assetPreviewUrls, setAssetPreviewUrls] = useState<Map<string, string>>(new Map());
  const editorRootRef = useRef<HTMLDivElement>(null);
  const fullscreen = useEditorFullscreen(editorRootRef);

  const scene = editor.selectedScene ?? editor.snapshot?.scenes[0] ?? null;

  // Workspace Assets for the Uploads panel (was inside ElementsPanel).
  useEffect(() => {
    let active = true;
    setAssets(null);
    setAssetPreviewUrls(new Map());

    listAssets(context.workspace.id, { status: "ready", limit: 30 })
      .then(async (res) => {
        if (!active) return;
        setAssets(res.assets);
        const previews = await Promise.all(res.assets.map(async (asset) => {
          try {
            const detail = await getAsset(asset.id);
            const entries: Array<readonly [string, string]> = [];
            const variant = selectAssetPreviewVariant(detail, "full");
            if (variant) {
              const signed = await signAssetRead(asset.id, variant.id);
              entries.push([asset.id, signed.signed_url]);
            }
            // PowerPoint/PDF assets can expose one image variant per page.
            // Keep those page keys too so existing asset_page elements render
            // the page they reference instead of falling back to a label.
            await Promise.all(detail.variants
              .filter((candidate) => candidate.asset_page_id && candidate.mime_type.startsWith("image/"))
              .map(async (candidate) => {
                const signed = await signAssetRead(asset.id, candidate.id);
                entries.push([candidate.asset_page_id!, signed.signed_url]);
              }));
            return entries;
          } catch {
            return [];
          }
        }));
        if (active) setAssetPreviewUrls(new Map(previews.flat()));
      })
      .catch(() => active && setAssets([]));

    return () => { active = false; };
  }, [context.workspace.id]);

  // Keyboard delete + arrow-key nudge for the selected Element. Declared
  // unconditionally (before the loading/error early returns below) so hook
  // call order stays stable across renders.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (!scene || !editor.selectedElementId) return;
      const element = scene.elements.find((item) => item.id === editor.selectedElementId);
      if (!element || element.is_locked) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        editor.removeElement(scene.id, element.id);
        return;
      }
      const step = event.shiftKey ? 5 : 1;
      if (event.key === "ArrowUp") editor.updateElement(scene.id, element.id, { y: Math.max(0, element.y - step) });
      if (event.key === "ArrowDown") editor.updateElement(scene.id, element.id, { y: Math.min(100 - element.height, element.y + step) });
      if (event.key === "ArrowLeft") editor.updateElement(scene.id, element.id, { x: Math.max(0, element.x - step) });
      if (event.key === "ArrowRight") editor.updateElement(scene.id, element.id, { x: Math.min(100 - element.width, element.x + step) });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scene, editor]);

  // The conflict Modal portals to document.body, which a fullscreen editor
  // root would cover — drop out of fullscreen so the user can see it.
  const exitFullscreen = fullscreen.exit;
  useEffect(() => {
    if (editor.saveState === "conflict") exitFullscreen();
  }, [editor.saveState, exitFullscreen]);

  if (editor.saveState === "loading") {
    return (
      <div style={{ height: "100vh", display: "grid", placeItems: "center" }}>
        <Spinner />
      </div>
    );
  }

  if (editor.loadError || !editor.snapshot) {
    return (
      <div className="scena-page">
        <ErrorBanner error={editor.loadError ?? new Error("This Board couldn't be loaded.")} />
        <div style={{ marginTop: 16 }}>
          <Button variant="secondary" onClick={() => navigate("/app/boards")}>Back to Boards</Button>
        </div>
      </div>
    );
  }

  const { snapshot } = editor;
  const sceneIndex = scene ? snapshot.scenes.findIndex((item) => item.id === scene.id) + 1 : 0;

  function handleAddElement(type: ElementType, assetId?: string, configOverride?: Record<string, unknown>) {
    if (!scene) return;
    const size = DEFAULT_SIZE[type];
    const element: SceneElement = {
      id: crypto.randomUUID(),
      element_type: type,
      render_mode: LIVE_ELEMENT_TYPES.includes(type) ? "live" : "static",
      name: null,
      x: 50 - size.width / 2,
      y: 50 - size.height / 2,
      width: size.width,
      height: size.height,
      rotation: 0,
      opacity: 1,
      z_index: scene.elements.length,
      is_locked: false,
      is_visible: true,
      asset_id: assetId ?? null,
      asset_page_id: null,
      config: configOverride ?? defaultConfigFor(type),
    };
    editor.addElement(scene.id, element);
  }

  // The Elements panel's Shape tile is a sub-palette (one button per
  // variant), each inserting a shape with a renderable, variant-specific
  // preset config and footprint — see components/editor/shapeVariants.tsx.
  function handleAddShape(variant: ShapeVariant) {
    if (!scene) return;
    const size = SHAPE_VARIANT_SIZE[variant];
    const element: SceneElement = {
      id: crypto.randomUUID(),
      element_type: "shape",
      render_mode: "static",
      name: null,
      x: 50 - size.width / 2,
      y: 50 - size.height / 2,
      width: size.width,
      height: size.height,
      rotation: 0,
      opacity: 1,
      z_index: scene.elements.length,
      is_locked: false,
      is_visible: true,
      asset_id: null,
      asset_page_id: null,
      config: SHAPE_VARIANT_PRESETS[variant],
    };
    editor.addElement(scene.id, element);
  }

  // Text quick-insert presets: only config.text is rendered/edited today,
  // so presets differ by default content and footprint.
  function handleAddTextPreset(preset: TextPresetSpec) {
    if (!scene) return;
    const element: SceneElement = {
      id: crypto.randomUUID(),
      element_type: "text",
      render_mode: "static",
      name: null,
      x: 50 - preset.width / 2,
      y: 50 - preset.height / 2,
      width: preset.width,
      height: preset.height,
      rotation: 0,
      opacity: 1,
      z_index: scene.elements.length,
      is_locked: false,
      is_visible: true,
      asset_id: null,
      asset_page_id: null,
      config: { text: preset.text },
    };
    editor.addElement(scene.id, element);
  }

  function handleAddScene() {
    const newScene: BoardScene = {
      id: crypto.randomUUID(),
      name: `Scene ${snapshot.scenes.length + 1}`,
      sort_order: snapshot.scenes.length,
      duration_ms: 10_000,
      transition_type: "fade",
      transition_config: {},
      background: { type: "color", value: snapshot.board.background_color },
      is_hidden: false,
      elements: [],
    };
    editor.addScene(newScene);
  }

  async function handleSave() {
    await editor.save();
  }

  function handleReloadLatest() {
    editor.reloadLatest();
  }

  async function handleSaveAsCopy() {
    const newId = await editor.saveAsCopy();
    if (newId) {
      toast.show("Saved as a new Board", "success");
      navigate(`/app/boards/${newId}`);
    }
  }

  function handleOpenRevisions() {
    // RevisionsDrawer portals to document.body — leave fullscreen first.
    fullscreen.exit();
    setRevisionsOpen(true);
    editor.loadRevisions();
  }

  const panelContent =
    activePanel === "elements" ? <ElementsGridPanel onAddElement={(type) => handleAddElement(type)} onAddShape={handleAddShape} onAddLibraryAsset={(type, config) => handleAddElement(type, undefined, config)} />
    : activePanel === "text" ? <TextPresetsPanel onInsertPreset={handleAddTextPreset} />
    : activePanel === "uploads" ? <UploadsPanel assets={assets} previewUrls={assetPreviewUrls} onInsertAsset={(assetId) => handleAddElement("asset_page", assetId)} />
    : activePanel === "templates" ? <PremiumUpsellPanel feature="templates" />
    : activePanel === "brand" ? <PremiumUpsellPanel feature="brand" />
    : null;

  return (
    <div className="scena-editor scena-editor--shell" ref={editorRootRef}>
      {liveSessionId && (
        <div className="scena-editor__live-banner" role="status">
          <Broadcast size={16} /> Live Session update mode — save to push the next Board version to connected Displays.
        </div>
      )}
      <EditorTopBar
        name={snapshot.board.name}
        onRename={editor.rename}
        onNavigateHome={() => navigate("/app/boards")}
        saveState={editor.saveState}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.undo}
        onRedo={editor.redo}
        canvasWidth={snapshot.board.canvas_width}
        canvasHeight={snapshot.board.canvas_height}
        onOpenRevisions={handleOpenRevisions}
        onSave={handleSave}
      />

      <div className="scena-editor__body">
        <EditorRail
          active={activePanel}
          onToggle={(key) => setActivePanel((current) => (current === key ? null : key))}
        >
          {panelContent}
        </EditorRail>

        {scene && (
          <EditorCanvas
            canvasWidth={snapshot.board.canvas_width}
            canvasHeight={snapshot.board.canvas_height}
            backgroundColor={snapshot.board.background_color}
            scene={scene}
            assetPreviewUrls={assetPreviewUrls}
            selectedElementId={editor.selectedElementId}
            onSelect={editor.setSelectedElementId}
            onCommit={(elementId, patch) => editor.updateElement(scene.id, elementId, patch)}
            zoom={zoom}
          />
        )}

        <PropertiesPanel
          element={editor.selectedElement}
          onChange={(patch) => scene && editor.selectedElementId && editor.updateElement(scene.id, editor.selectedElementId, patch)}
          onDelete={() => scene && editor.selectedElementId && editor.removeElement(scene.id, editor.selectedElementId)}
          onLayerMove={(direction) => {
            if (!scene || !editor.selectedElement) return;
            const delta = direction === "up" ? 1 : -1;
            editor.updateElement(scene.id, editor.selectedElement.id, { z_index: editor.selectedElement.z_index + delta });
          }}
        />
      </div>

      {scenesVisible && (
      <SceneStrip
        scenes={snapshot.scenes}
        selectedSceneId={scene?.id ?? null}
        onSelect={editor.setSelectedSceneId}
        onAddScene={handleAddScene}
        onReorder={editor.reorderScenes}
        onUpdateScene={(sceneId, patch) => editor.updateScene(sceneId, patch)}
      />
      )}

      <EditorBottomBar
        sceneIndex={sceneIndex}
        sceneCount={snapshot.scenes.length}
        zoom={zoom}
        onZoomChange={setZoom}
        scenesVisible={scenesVisible}
        onToggleScenes={() => setScenesVisible((value) => !value)}
        isFullscreen={fullscreen.isFullscreen}
        onToggleFullscreen={fullscreen.toggle}
        fullscreenSupported={fullscreen.supported}
      />

      <RevisionsDrawer
        open={revisionsOpen}
        onClose={() => setRevisionsOpen(false)}
        revisions={editor.revisions}
        onCreate={async (label) => {
          try {
            await editor.createRevision(label || undefined);
            toast.show("Revision saved", "success");
          } catch (err) {
            toast.show(err instanceof Error ? err.message : "Couldn't save revision.", "danger");
          }
        }}
      />

      <Modal
        open={editor.saveState === "conflict"}
        onClose={() => {}}
        title="This Board changed elsewhere"
        description="Someone else (or another tab) saved a newer version of this Board while you were editing. Saving now would overwrite their changes, so Scena stopped and needs you to choose."
        footer={
          <>
            <Button variant="secondary" onClick={handleReloadLatest}>Reload latest (discard my changes)</Button>
            <Button variant="primary" onClick={handleSaveAsCopy}>Save my changes as a new Board</Button>
          </>
        }
      />

      {editor.saveState === "failed" && editor.saveError ? (
        <div style={{ position: "fixed", bottom: 120, left: "50%", transform: "translateX(-50%)", width: 400, zIndex: 90 }}>
          <ErrorBanner error={editor.saveError} onRetry={handleSave} />
        </div>
      ) : null}
    </div>
  );
}
