import { useEffect, useMemo, useState } from "react";
import { ElementBody } from "../components/editor/ElementBody";
import type { SceneElement } from "../services/scena-api/boards";
import type { BoardData, BoardSceneData } from "./resolveDisplayState";

export function BoardRenderer({ board }: { board: BoardData }) {
  const scenes = useMemo(() => board.scenes.filter((scene) => !scene.is_hidden), [board.scenes]);
  const [sceneIndex, setSceneIndex] = useState(0);
  const scene = scenes[sceneIndex] ?? scenes[0] ?? null;

  useEffect(() => setSceneIndex(0), [board.id, board.version]);

  useEffect(() => {
    if (scenes.length < 2 || !scene) return;
    const timer = window.setTimeout(() => setSceneIndex((index) => (index + 1) % scenes.length), Math.max(1000, scene.duration_ms));
    return () => window.clearTimeout(timer);
  }, [scene, scenes.length]);

  if (!scene) return <div className="display-board" style={{ background: board.background_color }} />;

  return (
    <div
      className="display-board"
      data-board-id={board.id}
      data-session-started-at={board.session_started_at ?? undefined}
      data-session-updated-at={board.session_updated_at}
      style={{ background: backgroundValue(scene, board.background_color) }}
    >
      {scene.elements.filter((element) => element.is_visible).map((element) => (
        <div
          key={element.id}
          className="display-board__element"
          style={{
            left: `${element.x}%`, top: `${element.y}%`, width: `${element.width}%`, height: `${element.height}%`,
            transform: `rotate(${element.rotation}deg)`, opacity: element.opacity, zIndex: element.z_index,
          }}
        >
          <ElementBody element={element as SceneElement} />
        </div>
      ))}
    </div>
  );
}

function backgroundValue(scene: BoardSceneData, fallback: string): string {
  const value = scene.background?.value;
  return typeof value === "string" && value ? value : fallback;
}
