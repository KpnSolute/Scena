import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SessionScreen } from "../../domain/sessions";
import type { BoardSummary } from "../../services/scena-api/boards";
import { DisplayTopology } from "./DisplayTopology";

const screens = [0, 1].map((index) => ({
  id: `session-screen-${index}`,
  screen_id: `screen-${index}`,
  board_id: null,
  is_enabled: true,
  is_primary: index === 0,
  viewport_x_percent: 0,
  viewport_y_percent: 0,
  viewport_width_percent: 50,
  viewport_height_percent: 100,
} as SessionScreen));

const boards: BoardSummary[] = [{
  id: "board-1", workspace_id: "workspace-1", name: "Cafe menu", status: "active",
  canvas_width: 1920, canvas_height: 1080, background_color: "#000000", version: 1,
  created_by: "user-1", updated_by: "user-1", created_at: "2026-08-05T00:00:00Z", updated_at: "2026-08-05T00:00:00Z",
}];

describe("DisplayTopology", () => {
  it("applies arrangement presets and routes a Board from a monitor flyout", () => {
    const onViewport = vi.fn();
    const onBoard = vi.fn();
    render(<DisplayTopology screens={screens} screenNames={new Map([["screen-0", "Counter"], ["screen-1", "Window"]])} boards={boards} fallbackBoardId={null} onViewport={onViewport} onBoard={onBoard} />);

    fireEvent.click(screen.getByRole("button", { name: "Horizontal" }));
    expect(onViewport).toHaveBeenCalledTimes(2);

    fireEvent.change(screen.getByRole("combobox", { name: "Board for Counter" }), { target: { value: "board-1" } });
    expect(onBoard).toHaveBeenCalledWith("session-screen-0", "board-1");
  });
});
