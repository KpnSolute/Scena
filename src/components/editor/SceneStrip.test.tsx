import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SceneStrip } from "./SceneStrip";
import type { BoardScene } from "../../services/scena-api/boards";

const scenes: BoardScene[] = [
  { id: "one", name: "Breakfast", scene_type: "canvas", config: {}, sort_order: 0, duration_ms: 8000, transition_type: "fade", transition_config: {}, background: {}, is_hidden: false, elements: [] },
  { id: "two", name: "Lunch", scene_type: "canvas", config: {}, sort_order: 1, duration_ms: 10000, transition_type: "slide_left", transition_config: {}, background: {}, is_hidden: false, elements: [] },
];

describe("SceneStrip", () => {
  it("exposes complete keyboard-operable scene actions", () => {
    const select = vi.fn(); const duplicate = vi.fn(); const remove = vi.fn(); const update = vi.fn();
    render(<SceneStrip scenes={scenes} selectedSceneId="one" onSelect={select} onAddScene={vi.fn()} onReorder={vi.fn()} onUpdateScene={update} onDuplicate={duplicate} onDelete={remove} />);
    fireEvent.click(screen.getByRole("button", { name: /Breakfast/ }));
    fireEvent.click(screen.getByRole("button", { name: "Duplicate scene" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide scene" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete scene" }));
    expect(select).toHaveBeenCalledWith("one");
    expect(duplicate).toHaveBeenCalledWith("one");
    expect(update).toHaveBeenCalledWith("one", { is_hidden: true });
    expect(remove).toHaveBeenCalledWith("one");
  });
});
