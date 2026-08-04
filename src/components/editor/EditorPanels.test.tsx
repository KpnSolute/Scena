import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ElementsGridPanel } from "./EditorPanels";

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
