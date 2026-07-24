import { Plus, EyeSlash, CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { BoardScene } from "../../services/scena-api/boards";
import type { TransitionType } from "../../services/scena-api/boards";
import { IconButton } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

export interface SceneStripProps {
  scenes: BoardScene[];
  selectedSceneId: string | null;
  onSelect: (sceneId: string) => void;
  onAddScene: () => void;
  onReorder: (sceneId: string, direction: "left" | "right") => void;
  onUpdateScene?: (sceneId: string, patch: Partial<Pick<BoardScene, "duration_ms" | "transition_type">>) => void;
}

export function SceneStrip({ scenes, selectedSceneId, onSelect, onAddScene, onReorder, onUpdateScene = () => {} }: SceneStripProps) {
  const selected = scenes.find((scene) => scene.id === selectedSceneId) ?? null;
  return (
    <div className="scena-editor__scene-strip">
      {scenes.map((scene, index) => (
        <div
          key={scene.id}
          className={`scena-editor__scene-thumb${scene.id === selectedSceneId ? " scena-editor__scene-thumb--active" : ""}${scene.is_hidden ? " scena-editor__scene-thumb--hidden" : ""}`}
          onClick={() => onSelect(scene.id)}
        >
          {scene.is_hidden && <EyeSlash size={12} style={{ position: "absolute", top: 4, right: 4 }} />}
          <span style={{ fontWeight: 600, color: "var(--scena-text-secondary)" }}>{scene.name}</span>
          <span>{(scene.duration_ms / 1000).toFixed(0)}s · {scene.transition_type}</span>
          {scene.id === selectedSceneId && (
            <div style={{ position: "absolute", bottom: 2, display: "flex", gap: 2 }}>
              <IconButton
                icon={<CaretLeft size={10} />}
                label="Move scene earlier"
                size="sm"
                disabled={index === 0}
                onClick={(event) => { event.stopPropagation(); onReorder(scene.id, "left"); }}
                style={{ width: 20, height: 16 }}
              />
              <IconButton
                icon={<CaretRight size={10} />}
                label="Move scene later"
                size="sm"
                disabled={index === scenes.length - 1}
                onClick={(event) => { event.stopPropagation(); onReorder(scene.id, "right"); }}
                style={{ width: 20, height: 16 }}
              />
            </div>
          )}
        </div>
      ))}
      <IconButton icon={<Plus size={20} />} label="Add scene" onClick={onAddScene} />
      {selected && (
        <div className="scena-editor__scene-settings" onClick={(event) => event.stopPropagation()}>
          <label>Scene duration <Input type="number" min={1} max={86400} value={Math.round(selected.duration_ms / 1000)} onChange={(event) => onUpdateScene(selected.id, { duration_ms: Math.max(1000, Number(event.target.value) * 1000) })} /></label>
          <label>Transition <Select value={selected.transition_type as TransitionType} options={[{ value: "none", label: "None" }, { value: "fade", label: "Fade" }, { value: "slide_left", label: "Slide left" }, { value: "slide_right", label: "Slide right" }, { value: "zoom", label: "Zoom" }, { value: "dissolve", label: "Dissolve" }]} onChange={(event) => onUpdateScene(selected.id, { transition_type: event.target.value as TransitionType })} /></label>
        </div>
      )}
    </div>
  );
}
