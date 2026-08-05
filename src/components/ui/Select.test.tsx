import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./Select";

describe("Select", () => {
  it("opens a floating listbox and reports the selected value", () => {
    const onChange = vi.fn();
    render(
      <Select
        aria-label="Plan"
        value="free"
        onChange={onChange}
        options={[
          { value: "free", label: "Free" },
          { value: "pro", label: "Pro" },
        ]}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Plan" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("option", { name: "Pro" }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: { value: "pro" } }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("supports keyboard selection and Escape", () => {
    const onChange = vi.fn();
    render(
      <Select
        aria-label="Mode"
        value="single"
        onChange={onChange}
        options={[
          { value: "single", label: "Single" },
          { value: "extend", label: "Extend" },
        ]}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Mode" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("option", { name: "Extend" }), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: { value: "extend" } }));

    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("option", { name: "Single" }), { key: "Escape" });
    expect(trigger).toHaveFocus();
  });
});
