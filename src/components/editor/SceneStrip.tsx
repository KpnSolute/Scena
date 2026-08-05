import { Plus, EyeSlash, Eye, CaretLeft, CaretRight, Copy, Trash } from "@phosphor-icons/react";
import type { BoardScene, TransitionType } from "../../services/scena-api/boards";
import { IconButton } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { SIGN_LAYOUTS, sceneTypeOf, signLayoutOf, type SignLayoutId } from "../../domain/boardSceneTypes";

export interface SceneStripProps {
  scenes: BoardScene[];
  selectedSceneId: string | null;
  onSelect: (sceneId: string) => void;
  onAddScene: () => void;
  onReorder: (sceneId: string, direction: "left" | "right") => void;
  onUpdateScene?: (sceneId: string, patch: Partial<Pick<BoardScene, "name" | "duration_ms" | "transition_type" | "is_hidden" | "scene_type" | "config">>) => void;
  onApplySignLayout?: (sceneId: string, layoutId: SignLayoutId) => void;
  onDuplicate?: (sceneId: string) => void;
  onDelete?: (sceneId: string) => void;
}

export function SceneStrip({ scenes, selectedSceneId, onSelect, onAddScene, onReorder, onUpdateScene = () => {}, onApplySignLayout, onDuplicate, onDelete }: SceneStripProps) {
  const selected = scenes.find((scene) => scene.id === selectedSceneId) ?? null;
  return (
    <div className="scena-editor__scene-strip">
      {scenes.map((scene, index) => (
        <div key={scene.id} className={`scena-editor__scene-thumb${scene.id === selectedSceneId ? " scena-editor__scene-thumb--active" : ""}${scene.is_hidden ? " scena-editor__scene-thumb--hidden" : ""}`}>
          <button type="button" className="scena-editor__scene-select" onClick={() => onSelect(scene.id)} aria-pressed={scene.id === selectedSceneId}>
            {scene.is_hidden && <EyeSlash size={12} className="scena-editor__scene-hidden-icon" />}
            <span className={`scena-editor__scene-type scena-editor__scene-type--${sceneTypeOf(scene)}`}>{sceneTypeOf(scene)}</span>
            <span className="scena-editor__scene-name">{scene.name}</span>
            <span>{Math.round(scene.duration_ms / 1000)}s · {scene.transition_type.replace("_", " ")}</span>
          </button>
          {scene.id === selectedSceneId && (
            <div className="scena-editor__scene-actions">
              <IconButton icon={<CaretLeft size={10} />} label="Move scene earlier" size="sm" disabled={index === 0} onClick={() => onReorder(scene.id, "left")} style={{ width: 20, height: 16 }} />
              <IconButton icon={<CaretRight size={10} />} label="Move scene later" size="sm" disabled={index === scenes.length - 1} onClick={() => onReorder(scene.id, "right")} style={{ width: 20, height: 16 }} />
              {onDuplicate && <IconButton icon={<Copy size={10} />} label="Duplicate scene" size="sm" onClick={() => onDuplicate(scene.id)} style={{ width: 20, height: 16 }} />}
              <IconButton icon={scene.is_hidden ? <Eye size={10} /> : <EyeSlash size={10} />} label={scene.is_hidden ? "Show scene" : "Hide scene"} size="sm" onClick={() => onUpdateScene(scene.id, { is_hidden: !scene.is_hidden })} style={{ width: 20, height: 16 }} />
              {onDelete && <IconButton icon={<Trash size={10} />} label="Delete scene" size="sm" disabled={scenes.length <= 1} onClick={() => onDelete(scene.id)} style={{ width: 20, height: 16 }} />}
            </div>
          )}
        </div>
      ))}
      <IconButton icon={<Plus size={20} />} label="Add scene" onClick={onAddScene} />
      {selected && (
        <div className="scena-editor__scene-settings">
          <label>Scene name <Input value={selected.name} onChange={(event) => onUpdateScene(selected.id, { name: event.target.value || "Untitled scene" })} /></label>
          <label>Duration <Input aria-label="Scene duration in seconds" type="number" min={1} max={86400} value={Math.round(selected.duration_ms / 1000)} onChange={(event) => onUpdateScene(selected.id, { duration_ms: Math.max(1000, Number(event.target.value) * 1000) })} /></label>
          <label>Transition <Select value={selected.transition_type as TransitionType} options={[{ value: "none", label: "None" }, { value: "fade", label: "Fade" }, { value: "slide_left", label: "Slide left" }, { value: "slide_right", label: "Slide right" }, { value: "zoom", label: "Zoom" }, { value: "dissolve", label: "Dissolve" }]} onChange={(event) => onUpdateScene(selected.id, { transition_type: event.target.value as TransitionType })} /></label>
          {sceneTypeOf(selected) === "sign" && onApplySignLayout && (
            <label>Zones <Select value={signLayoutOf(selected).id} options={SIGN_LAYOUTS.map((layout) => ({ value: layout.id, label: layout.label }))} onChange={(event) => onApplySignLayout(selected.id, event.target.value as SignLayoutId)} /></label>
          )}
        </div>
      )}
    </div>
  );
}
