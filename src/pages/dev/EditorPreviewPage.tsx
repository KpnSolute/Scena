// Internal-only QA page for the Canva-style editor shell: mounts the SAME
// presentational shell + EditorCanvas/PropertiesPanel/SceneStrip as the real
// Board editor, driven by purely in-memory demo state (mirrors the approach
// in src/pages/landing/HeroEditorDemo.tsx). No auth, no network, nothing is
// persisted. Not linked from any production nav — reachable at /dev/editor.
import { useRef, useState } from "react";
import type { BoardScene, SceneElement, ElementType, ShapeVariant } from "../../services/scena-api/boards";
import {
  EditorTopBar, EditorRail, EditorBottomBar, useEditorFullscreen,
} from "../../components/editor/EditorShell";
import type { EditorRailItemKey } from "../../components/editor/EditorShell";
import {
  ElementsGridPanel, TextPresetsPanel, UploadsPanel, TemplatesPanel, BrandPanel,
} from "../../components/editor/EditorPanels";
import type { TextPresetSpec } from "../../components/editor/EditorPanels";
import { applyBrandPreset, createSceneFromTemplate } from "../../components/editor/studioPresets";
import { EditorCanvas } from "../../components/editor/EditorCanvas";
import { PropertiesPanel } from "../../components/editor/PropertiesPanel";
import { SceneStrip } from "../../components/editor/SceneStrip";
import { SHAPE_VARIANT_PRESETS, SHAPE_VARIANT_SIZE } from "../../components/editor/shapeVariants";
import type { SaveState } from "../boards/useBoardEditor";

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const BACKGROUND_COLOR = "#0f1220";
const MAX_HISTORY = 50;

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

function demoElement(partial: Partial<SceneElement> & Pick<SceneElement, "id" | "element_type" | "x" | "y" | "width" | "height">): SceneElement {
  return {
    render_mode: "static",
    name: null,
    rotation: 0,
    opacity: 1,
    z_index: 0,
    is_locked: false,
    is_visible: true,
    asset_id: null,
    asset_page_id: null,
    config: {},
    ...partial,
  };
}

function buildDemoScenes(): BoardScene[] {
  return [
    {
      id: "preview-scene-1",
      name: "Welcome",
      scene_type: "canvas",
      config: {},
      sort_order: 0,
      duration_ms: 8000,
      transition_type: "fade",
      transition_config: {},
      background: { type: "color", value: BACKGROUND_COLOR },
      is_hidden: false,
      elements: [
        demoElement({ id: "preview-headline", element_type: "text", x: 6, y: 10, width: 52, height: 12, z_index: 1, config: { text: "Welcome to Scena" } }),
        demoElement({ id: "preview-sub", element_type: "text", x: 6, y: 28, width: 44, height: 7, z_index: 2, config: { text: "Editor shell preview — nothing is saved" } }),
        demoElement({ id: "preview-shape", element_type: "shape", x: 62, y: 20, width: 30, height: 42, z_index: 0, config: { fill: "#5b7cfa" } }),
        demoElement({ id: "preview-clock", element_type: "clock", render_mode: "live", x: 6, y: 80, width: 20, height: 10, z_index: 3 }),
      ],
    },
    {
      id: "preview-scene-2",
      name: "Specials",
      scene_type: "canvas",
      config: {},
      sort_order: 1,
      duration_ms: 6000,
      transition_type: "slide_left",
      transition_config: {},
      background: { type: "color", value: BACKGROUND_COLOR },
      is_hidden: false,
      elements: [
        demoElement({ id: "preview-2-title", element_type: "text", x: 8, y: 16, width: 56, height: 12, z_index: 1, config: { text: "Today's specials" } }),
        demoElement({ id: "preview-2-shape", element_type: "shape", x: 64, y: 18, width: 28, height: 40, z_index: 0, config: { fill: "#7eb3ff" } }),
        demoElement({ id: "preview-2-ticker", element_type: "ticker", render_mode: "live", name: "Now playing: lo-fi", x: 0, y: 88, width: 100, height: 8, z_index: 2 }),
      ],
    },
  ];
}

export function EditorPreviewPage() {
  const [scenes, setScenes] = useState<BoardScene[]>(buildDemoScenes);
  const [boardName, setBoardName] = useState("Editor preview — demo Board");
  const [selectedSceneId, setSelectedSceneId] = useState<string>("preview-scene-1");
  const [selectedElementId, setSelectedElementId] = useState<string | null>("preview-headline");
  const [zoom, setZoom] = useState(100);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [activePanel, setActivePanel] = useState<EditorRailItemKey | null>("elements");
  const [scenesVisible, setScenesVisible] = useState(true);

  const history = useRef<{ past: BoardScene[][]; future: BoardScene[][] }>({ past: [], future: [] });
  const editorRootRef = useRef<HTMLDivElement>(null);
  const fullscreen = useEditorFullscreen(editorRootRef);

  function mutate(updater: (draft: BoardScene[]) => BoardScene[]) {
    setScenes((prev) => {
      history.current.past = [...history.current.past.slice(-MAX_HISTORY + 1), prev];
      history.current.future = [];
      return updater(prev);
    });
    setSaveState("unsaved");
  }

  function undo() {
    setScenes((current) => {
      const prev = history.current.past.pop();
      if (!prev) return current;
      history.current.future = [current, ...history.current.future].slice(0, MAX_HISTORY);
      return prev;
    });
    setSaveState("unsaved");
  }

  function redo() {
    setScenes((current) => {
      const next = history.current.future.shift();
      if (!next) return current;
      history.current.past = [...history.current.past, current].slice(-MAX_HISTORY);
      return next;
    });
    setSaveState("unsaved");
  }

  const canUndo = history.current.past.length > 0;
  const canRedo = history.current.future.length > 0;

  const scene = scenes.find((item) => item.id === selectedSceneId) ?? scenes[0];
  const selectedElement = scene.elements.find((element) => element.id === selectedElementId) ?? null;
  const sceneIndex = scenes.findIndex((item) => item.id === scene.id) + 1;

  function updateElement(sceneId: string, elementId: string, patch: Partial<SceneElement>) {
    mutate((draft) => draft.map((item) =>
      item.id === sceneId
        ? { ...item, elements: item.elements.map((element) => (element.id === elementId ? { ...element, ...patch } : element)) }
        : item,
    ));
  }

  function removeElement(sceneId: string, elementId: string) {
    mutate((draft) => draft.map((item) =>
      item.id === sceneId ? { ...item, elements: item.elements.filter((element) => element.id !== elementId) } : item,
    ));
    setSelectedElementId(null);
  }

  function insertElement(element: SceneElement) {
    const sceneId = scene.id;
    mutate((draft) => draft.map((item) => (item.id === sceneId ? { ...item, elements: [...item.elements, element] } : item)));
    setSelectedElementId(element.id);
  }

  function addElement(type: ElementType) {
    const size = DEFAULT_SIZE[type];
    insertElement(demoElement({
      id: crypto.randomUUID(),
      element_type: type,
      render_mode: LIVE_ELEMENT_TYPES.includes(type) ? "live" : "static",
      x: 50 - size.width / 2,
      y: 50 - size.height / 2,
      width: size.width,
      height: size.height,
      z_index: scene.elements.length,
      config: type === "text" ? { text: "Text" } : type === "shape" ? { fill: "#5b7cfa" } : {},
    }));
  }

  function addShape(variant: ShapeVariant) {
    const size = SHAPE_VARIANT_SIZE[variant];
    insertElement(demoElement({
      id: crypto.randomUUID(),
      element_type: "shape",
      x: 50 - size.width / 2,
      y: 50 - size.height / 2,
      width: size.width,
      height: size.height,
      z_index: scene.elements.length,
      config: SHAPE_VARIANT_PRESETS[variant],
    }));
  }

  function addTextPreset(preset: TextPresetSpec) {
    insertElement(demoElement({
      id: crypto.randomUUID(),
      element_type: "text",
      x: 50 - preset.width / 2,
      y: 50 - preset.height / 2,
      width: preset.width,
      height: preset.height,
      z_index: scene.elements.length,
      config: { text: preset.text },
    }));
  }

  function updateScene(sceneId: string, patch: Partial<BoardScene>) {
    mutate((draft) => draft.map((item) => item.id === sceneId ? { ...item, ...patch } : item));
  }

  function duplicateScene(sceneId: string) {
    const source = scenes.find((item) => item.id === sceneId);
    if (!source) return;
    const copy = { ...source, id: crypto.randomUUID(), name: `${source.name} copy`, elements: source.elements.map((element) => ({ ...element, id: crypto.randomUUID(), config: { ...element.config } })) };
    mutate((draft) => [...draft, copy]);
    setSelectedSceneId(copy.id);
  }

  function deleteScene(sceneId: string) {
    if (scenes.length <= 1) return;
    const remaining = scenes.filter((item) => item.id !== sceneId);
    mutate(() => remaining);
    setSelectedSceneId(remaining[0].id);
    setSelectedElementId(null);
  }

  function addLibraryAsset(type: "image" | "text", config: Record<string, unknown>) {
    const size = DEFAULT_SIZE[type];
    insertElement(demoElement({
      id: crypto.randomUUID(),
      element_type: type,
      x: 50 - size.width / 2,
      y: 50 - size.height / 2,
      width: size.width,
      height: size.height,
      z_index: scene.elements.length,
      config,
    }));
  }

  function addScene() {
    const newScene: BoardScene = {
      id: crypto.randomUUID(),
      name: `Scene ${scenes.length + 1}`,
      scene_type: "canvas",
      config: {},
      sort_order: scenes.length,
      duration_ms: 10_000,
      transition_type: "fade",
      transition_config: {},
      background: { type: "color", value: BACKGROUND_COLOR },
      is_hidden: false,
      elements: [],
    };
    mutate((draft) => [...draft, newScene]);
    setSelectedSceneId(newScene.id);
    setSelectedElementId(null);
  }

  function reorderScenes(sceneId: string, direction: "left" | "right") {
    mutate((draft) => {
      const index = draft.findIndex((item) => item.id === sceneId);
      const swapWith = direction === "left" ? index - 1 : index + 1;
      if (index === -1 || swapWith < 0 || swapWith >= draft.length) return draft;
      const next = [...draft];
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return next.map((item, order) => ({ ...item, sort_order: order }));
    });
  }

  // Demo save: no backend — just walk the state machine so the shell's
  // save indicator and button states can be QA'd.
  function handleSave() {
    setSaveState("saving");
    window.setTimeout(() => setSaveState("saved"), 600);
  }

  const panelContent =
    activePanel === "elements" ? <ElementsGridPanel onAddElement={addElement} onAddShape={addShape} onAddLibraryAsset={addLibraryAsset} />
    : activePanel === "text" ? <TextPresetsPanel onInsertPreset={addTextPreset} />
    // Preview never fetches: Uploads shows its empty state.
    : activePanel === "uploads" ? <UploadsPanel assets={[]} onInsertAsset={() => {}} />
    : activePanel === "templates" ? <TemplatesPanel onApply={(templateId) => { const next = createSceneFromTemplate(templateId, scenes.length); mutate((draft) => [...draft, next]); setSelectedSceneId(next.id); }} />
    : activePanel === "brand" ? <BrandPanel onApply={(brand) => mutate((draft) => draft.map((item) => item.id === scene.id ? { ...item, ...applyBrandPreset(item, brand) } : item))} />
    : null;

  return (
    <div className="scena-editor scena-editor--shell" ref={editorRootRef}>
      <EditorTopBar
        name={boardName}
        onRename={setBoardName}
        onNavigateHome={() => window.history.back()}
        saveState={saveState}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        canvasWidth={CANVAS_WIDTH}
        canvasHeight={CANVAS_HEIGHT}
        onSave={handleSave}
      />

      <div className="scena-editor__body">
        <EditorRail
          active={activePanel}
          onToggle={(key) => setActivePanel((current) => (current === key ? null : key))}
        >
          {panelContent}
        </EditorRail>

        <EditorCanvas
          canvasWidth={CANVAS_WIDTH}
          canvasHeight={CANVAS_HEIGHT}
          backgroundColor={BACKGROUND_COLOR}
          scene={scene}
          selectedElementId={selectedElementId}
          onSelect={setSelectedElementId}
          onCommit={(elementId, patch) => updateElement(scene.id, elementId, patch)}
          zoom={zoom}
        />

        <PropertiesPanel
          element={selectedElement}
          onChange={(patch) => selectedElementId && updateElement(scene.id, selectedElementId, patch)}
          onDelete={() => selectedElementId && removeElement(scene.id, selectedElementId)}
          onDuplicate={() => selectedElement && insertElement({ ...selectedElement, id: crypto.randomUUID(), x: selectedElement.x + 2, y: selectedElement.y + 2, config: { ...selectedElement.config } })}
          onLayerMove={(direction) => {
            if (!selectedElement) return;
            const delta = direction === "up" ? 1 : -1;
            updateElement(scene.id, selectedElement.id, { z_index: selectedElement.z_index + delta });
          }}
        />
      </div>

      {scenesVisible && (
        <SceneStrip
          scenes={scenes}
          selectedSceneId={scene.id}
          onSelect={(sceneId) => { setSelectedSceneId(sceneId); setSelectedElementId(null); }}
          onAddScene={addScene}
          onReorder={reorderScenes}
          onUpdateScene={updateScene}
          onDuplicate={duplicateScene}
          onDelete={deleteScene}
        />
      )}

      <EditorBottomBar
        sceneIndex={sceneIndex}
        sceneCount={scenes.length}
        zoom={zoom}
        onZoomChange={setZoom}
        scenesVisible={scenesVisible}
        onToggleScenes={() => setScenesVisible((value) => !value)}
        isFullscreen={fullscreen.isFullscreen}
        onToggleFullscreen={fullscreen.toggle}
        fullscreenSupported={fullscreen.supported}
      />
    </div>
  );
}
