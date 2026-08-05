import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoardChoiceGrid } from "./BoardChoiceGrid";

describe("BoardChoiceGrid", () => {
  it("selects a Board by tapping its card", () => {
    const onChange = vi.fn();
    render(
      <BoardChoiceGrid
        label="Board for every Display"
        hint="Every selected Display will play this Board."
        boards={[{
          id: "board-1",
          workspace_id: "workspace-1",
          name: "Cafe menu",
          canvas_width: 1920,
          canvas_height: 1080,
          background_color: "#10131f",
          status: "active",
          version: 3,
          created_by: "user-1",
          updated_by: "user-1",
          created_at: "2026-08-05T00:00:00Z",
          updated_at: "2026-08-05T00:00:00Z",
        }]}
        value=""
        onChange={onChange}
      />,
    );

    const board = screen.getByRole("button", { name: /Cafe menu.*1920 × 1080.*v3/i });
    expect(board).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(board);
    expect(onChange).toHaveBeenCalledWith("board-1");
  });
});
