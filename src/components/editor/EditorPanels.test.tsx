import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ElementsGridPanel, LayersPanel } from "./EditorPanels";
import type { BoardScene } from "../../services/scena-api/boards";

describe("ElementsGridPanel", () => {
  it("uses customer-facing categories instead of storage terminology", () => {
    render(<ElementsGridPanel onAddElement={vi.fn()} onAddShape={vi.fn()} />);

    expect(screen.getByText("Menu board starters")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByText("Display widgets")).toBeInTheDocument();
    expect(screen.getByText("Connections")).toBeInTheDocument();
    expect(screen.queryByText("Static")).not.toBeInTheDocument();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
  });

  it("searches by the job an element performs", () => {
    render(<ElementsGridPanel onAddElement={vi.fn()} onAddShape={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Search content and widgets"), { target: { value: "announcement" } });

    expect(screen.getByText("Ticker")).toBeInTheDocument();
    expect(screen.queryByText("Clock")).not.toBeInTheDocument();
    expect(screen.queryByText("Menu board starters")).not.toBeInTheDocument();
  });

  it("inserts a styled menu starter through the existing persisted text element", () => {
    const onAddLibraryAsset = vi.fn();
    render(<ElementsGridPanel onAddElement={vi.fn()} onAddShape={vi.fn()} onAddLibraryAsset={onAddLibraryAsset} />);

    fireEvent.click(screen.getByRole("button", { name: /Menu title/ }));

    expect(onAddLibraryAsset).toHaveBeenCalledWith("text", expect.objectContaining({
      text: "Today’s Menu",
      font_family: "display",
      font_weight: 800,
    }));
  });

  it("marks unconnected capabilities as setup instead of presenting them as live", () => {
    render(<ElementsGridPanel onAddElement={vi.fn()} onAddShape={vi.fn()} />);

    const connectedText = screen.getByRole("button", { name: /Connected text/ });
    expect(connectedText).toHaveTextContent("Setup");
    expect(connectedText).toHaveTextContent("future value from an API or webhook field");
  });
});

describe("LayersPanel", () => {
  const scene: BoardScene = {
    id: "scene-1", name: "Scene 1", scene_type: "canvas", config: {}, sort_order: 0,
    duration_ms: 10_000, transition_type: "fade", transition_config: {}, background: {}, is_hidden: false,
    elements: [
      { id: "back", element_type: "shape", render_mode: "static", name: null, x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, z_index: 0, is_locked: false, is_visible: true, asset_id: null, asset_page_id: null, config: { variant: "rectangle" } },
      { id: "front", element_type: "text", render_mode: "static", name: null, x: 10, y: 10, width: 30, height: 10, rotation: 0, opacity: 1, z_index: 2, is_locked: false, is_visible: true, asset_id: null, asset_page_id: null, config: { text: "Today’s Menu" } },
    ],
  };

  it("shows front-to-back layers with direct visibility, lock, and ordering controls", () => {
    const onSelect = vi.fn();
    const onChange = vi.fn();
    const onMove = vi.fn();
    render(<LayersPanel scene={scene} selectedElementId="front" onSelect={onSelect} onChange={onChange} onMove={onMove} />);

    const layers = screen.getAllByRole("listitem");
    expect(layers[0]).toHaveTextContent("Today’s Menu");
    expect(screen.getByRole("button", { name: /Today’s Menu Text/ })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Lock Today’s Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide Today’s Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Move Today’s Menu backward" }));

    expect(onChange).toHaveBeenNthCalledWith(1, "front", { is_locked: true });
    expect(onChange).toHaveBeenNthCalledWith(2, "front", { is_visible: false });
    expect(onMove).toHaveBeenCalledWith("front", "down");
  });
});
