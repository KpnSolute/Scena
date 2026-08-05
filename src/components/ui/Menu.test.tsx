import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DropdownMenu } from "./Menu";

describe("DropdownMenu", () => {
  it("portals its popover outside overflow containers and runs the selected action", () => {
    const onSelect = vi.fn();
    render(<div style={{ overflow: "auto" }}><DropdownMenu trigger={<button type="button">Actions</button>} items={[{ key: "open", label: "Open control room", onSelect }]} /></div>);
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    const menu = screen.getByRole("menu");
    expect(menu.parentElement?.parentElement).toBe(document.body);
    fireEvent.click(screen.getByRole("menuitem", { name: "Open control room" }));
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
