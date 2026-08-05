// Interactive Board-editor demo embedded in the landing-page hero.
// Reuses the REAL editor components (EditorCanvas, PropertiesPanel,
// SceneStrip) driven by purely in-memory state — no network, no Supabase,
// nothing is persisted. The toolbar is a slim local variant of the real
// EditorToolbar (same CSS classes) because the real one's props are tied to
// save/revision API concepts that don't exist here.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowCounterClockwise, ArrowClockwise, MagnifyingGlassMinus, MagnifyingGlassPlus,
  TextT, Square, Clock as ClockIcon,
} from "@phosphor-icons/react";
import type { BoardScene, SceneElement, ElementType } from "../../services/scena-api/boards";
import { EditorCanvas } from "../../components/editor/EditorCanvas";
import { PropertiesPanel } from "../../components/editor/PropertiesPanel";
import { SceneStrip } from "../../components/editor/SceneStrip";
import { IconButton, Button } from "../../components/ui/Button";

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const BACKGROUND_COLOR = "#0f1220";

// Mirrors EditorCanvas's internal BASE_SCALE so the fit-to-container zoom
// computation matches what the canvas actually renders at a given zoom.
const CANVAS_BASE_SCALE = 0.4;

const MAX_HISTORY = 50;

const DEFAULT_SIZE: Record<string, { width: number; height: number }> = {
  text: { width: 30, height: 8 },
  shape: { width: 20, height: 20 },
  clock: { width: 20, height: 10 },
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
      id: "demo-scene-menu",
      name: "Menu",
      scene_type: "canvas",
      config: {},
      sort_order: 0,
      duration_ms: 8000,
      transition_type: "fade",
      transition_config: {},
      background: { type: "color", value: BACKGROUND_COLOR },
      is_hidden: false,
      elements: [
        demoElement({ id: "demo-headline", element_type: "text", x: 4, y: 6, width: 62, height: 11, z_index: 1, config: { text: "Café Scena — today's menu" } }),
        demoElement({ id: "demo-item-1", element_type: "text", x: 6, y: 26, width: 42, height: 7, z_index: 2, config: { text: "Flat white — $4.50" } }),
        demoElement({ id: "demo-item-2", element_type: "text", x: 6, y: 36, width: 42, height: 7, z_index: 3, config: { text: "Cold brew — $5.00" } }),
        demoElement({ id: "demo-item-3", element_type: "text", x: 6, y: 46, width: 42, height: 7, z_index: 4, config: { text: "Butter croissant — $3.75" } }),
        demoElement({ id: "demo-photo", element_type: "shape", x: 56, y: 24, width: 36, height: 40, z_index: 0, config: { fill: "#5b7cfa" } }),
        demoElement({ id: "demo-badge", element_type: "text", x: 76, y: 8, width: 18, height: 7, z_index: 5, config: { text: "Fresh daily" } }),
        demoElement({ id: "demo-ticker", element_type: "ticker", render_mode: "live", name: "Now brewing: Ethiopia Yirgacheffe", x: 0, y: 88, width: 100, height: 8, z_index: 6 }),
      ],
    },
    {
      id: "demo-scene-happy-hour",
      name: "Happy hour",
      scene_type: "canvas",
      config: {},
      sort_order: 1,
      duration_ms: 6000,
      transition_type: "slide_left",
      transition_config: {},
      background: { type: "color", value: BACKGROUND_COLOR },
      is_hidden: false,
      elements: [
        demoElement({ id: "demo-hh-title", element_type: "text", x: 8, y: 16, width: 56, height: 12, z_index: 1, config: { text: "Happy hour, 4–6 pm" } }),
        demoElement({ id: "demo-hh-sub", element_type: "text", x: 8, y: 34, width: 48, height: 8, z_index: 2, config: { text: "All espresso drinks $1 off" } }),
        demoElement({ id: "demo-hh-shape", element_type: "shape", x: 64, y: 18, width: 28, height: 40, z_index: 0, config: { fill: "#22d3ee" } }),
        demoElement({ id: "demo-hh-clock", element_type: "clock", render_mode: "live", x: 6, y: 78, width: 20, height: 10, z_index: 3 }),
      ],
    },
  ];
}

export function HeroEditorDemo() {
  const [scenes, setScenes] = useState<BoardScene[]>(buildDemoScenes);
  const [boardName, setBoardName] = useState("Café Menu — demo Board");
  const [selectedSceneId, setSelectedSceneId] = useState<string>("demo-scene-menu");
  const [selectedElementId, setSelectedElementId] = useState<string | null>("demo-headline");
  const [userZoom, setUserZoom] = useState(100);
  const [fitZoom, setFitZoom] = useState(100);

  const history = useRef<{ past: BoardScene[][]; future: BoardScene[][] }>({ past: [], future: [] });
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  // Fit the (fixed-size) editor canvas into whatever space the hero frame
  // gives it: observe the canvas area and derive the zoom that makes the
  // board fill it, so the demo scales instead of overflowing.
  useEffect(() => {
    const node = canvasAreaRef.current;
    if (!node) return;
    const baseWidth = CANVAS_WIDTH * CANVAS_BASE_SCALE;
    const baseHeight = CANVAS_HEIGHT * CANVAS_BASE_SCALE;
    const padding = 40;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const fit = Math.min((rect.width - padding) / baseWidth, (rect.height - padding) / baseHeight);
      setFitZoom(Math.max(10, Math.floor(fit * 100)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const zoom = Math.max(10, Math.round((fitZoom * userZoom) / 100));

  function mutate(updater: (draft: BoardScene[]) => BoardScene[]) {
    setScenes((prev) => {
      history.current.past = [...history.current.past.slice(-MAX_HISTORY + 1), prev];
      history.current.future = [];
      return updater(prev);
    });
  }

  function undo() {
    setScenes((current) => {
      const prev = history.current.past.pop();
      if (!prev) return current;
      history.current.future = [current, ...history.current.future].slice(0, MAX_HISTORY);
      return prev;
    });
  }

  function redo() {
    setScenes((current) => {
      const next = history.current.future.shift();
      if (!next) return current;
      history.current.past = [...history.current.past, current].slice(-MAX_HISTORY);
      return next;
    });
  }

  const canUndo = history.current.past.length > 0;
  const canRedo = history.current.future.length > 0;

  const scene = scenes.find((item) => item.id === selectedSceneId) ?? scenes[0];
  const selectedElement = scene.elements.find((element) => element.id === selectedElementId) ?? null;

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

  function addElement(type: ElementType) {
    const size = DEFAULT_SIZE[type] ?? { width: 20, height: 10 };
    const element = demoElement({
      id: crypto.randomUUID(),
      element_type: type,
      render_mode: type === "clock" ? "live" : "static",
      x: 50 - size.width / 2,
      y: 50 - size.height / 2,
      width: size.width,
      height: size.height,
      z_index: scene.elements.length,
      config: type === "text" ? { text: "New text" } : type === "shape" ? { fill: "#5b7cfa" } : {},
    });
    const sceneId = scene.id;
    mutate((draft) => draft.map((item) => (item.id === sceneId ? { ...item, elements: [...item.elements, element] } : item)));
    setSelectedElementId(element.id);
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

  return (
    <div className="scena-hero-demo">
      <div className="scena-hero-demo__frame scena-glass-strong">
        <div className="scena-hero-demo__bar">
          <span /><span /><span />
          <span className="scena-hero-demo__bar-title">Scena — Board editor</span>
        </div>

        <div className="scena-hero-demo__editor">
          <header className="scena-editor__toolbar">
            <input
              className="scena-editor__name-input"
              value={boardName}
              onChange={(event) => setBoardName(event.target.value)}
              aria-label="Board name"
            />
            <IconButton icon={<ArrowCounterClockwise size={18} />} label="Undo" disabled={!canUndo} onClick={undo} size="sm" />
            <IconButton icon={<ArrowClockwise size={18} />} label="Redo" disabled={!canRedo} onClick={redo} size="sm" />
            <span className="scena-hero-demo__dims">{CANVAS_WIDTH} × {CANVAS_HEIGHT}</span>

            <div className="scena-editor__spacer" />

            <div className="scena-hero-demo__add">
              <Button variant="secondary" size="sm" icon={<TextT size={14} />} onClick={() => addElement("text")}>Text</Button>
              <Button variant="secondary" size="sm" icon={<Square size={14} />} onClick={() => addElement("shape")}>Shape</Button>
              <Button variant="secondary" size="sm" icon={<ClockIcon size={14} />} onClick={() => addElement("clock")}>Clock</Button>
            </div>

            <div className="scena-editor__zoom">
              <IconButton icon={<MagnifyingGlassMinus size={16} />} label="Zoom out" size="sm" onClick={() => setUserZoom((value) => Math.max(50, value - 25))} />
              {userZoom}%
              <IconButton icon={<MagnifyingGlassPlus size={16} />} label="Zoom in" size="sm" onClick={() => setUserZoom((value) => Math.min(150, value + 25))} />
            </div>
          </header>

          <div className="scena-editor__body">
            <div className="scena-hero-demo__canvas-area" ref={canvasAreaRef}>
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
            </div>

            <PropertiesPanel
              element={selectedElement}
              onChange={(patch) => selectedElementId && updateElement(scene.id, selectedElementId, patch)}
              onDelete={() => selectedElementId && removeElement(scene.id, selectedElementId)}
              onLayerMove={(direction) => {
                if (!selectedElement) return;
                const delta = direction === "up" ? 1 : -1;
                updateElement(scene.id, selectedElement.id, { z_index: selectedElement.z_index + delta });
              }}
            />
          </div>

          <SceneStrip
            scenes={scenes}
            selectedSceneId={scene.id}
            onSelect={(sceneId) => { setSelectedSceneId(sceneId); setSelectedElementId(null); }}
            onAddScene={addScene}
            onReorder={reorderScenes}
          />
        </div>
      </div>

      <div className="scena-hero-demo__caption">
        <span>Try it — this is the real editor, running in your browser. Nothing is saved.</span>
        <Link to="/login">Start free to build your own →</Link>
      </div>
    </div>
  );
}
