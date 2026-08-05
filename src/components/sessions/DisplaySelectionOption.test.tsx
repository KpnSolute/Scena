import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DisplaySelectionOption } from "./DisplaySelectionOption";

describe("DisplaySelectionOption", () => {
  it("uses the entire display option as the selection control", () => {
    const onToggle = vi.fn();
    render(<DisplaySelectionOption name="Home" selected={false} onToggle={onToggle} />);

    const option = screen.getByRole("button", { name: /Home.*Ready/i });
    expect(option).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    fireEvent.click(option);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("exposes the selected state on the option", () => {
    render(<DisplaySelectionOption name="Home" selected onToggle={() => undefined} />);

    expect(screen.getByRole("button", { name: /Home.*Ready/i })).toHaveAttribute("aria-pressed", "true");
  });
});
