import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SceneElement } from "../../services/scena-api/boards";
import { ElementBody } from "./ElementBody";

function element(element_type: SceneElement["element_type"], config: Record<string, unknown> = {}): SceneElement {
  return { id: element_type, element_type, render_mode: "live", name: null, x: 0, y: 0, width: 20, height: 20, rotation: 0, opacity: 1, z_index: 0, is_locked: false, is_visible: true, asset_id: null, asset_page_id: null, config };
}

describe("ElementBody renderers", () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    ["clock", { }, /:/],
    ["date", { }, /\d/],
    ["ticker", { text: "Now boarding" }, /Now boarding/],
    ["weather", { temperature: "72°", condition: "Sunny" }, /72°/],
    ["data_text", { value: "42 guests" }, /42 guests/],
  ] as const)("renders a visual %s preview", (type, config, expected) => {
    render(<ElementBody element={element(type, config)} />);
    expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
    expect(screen.queryByText(type.replace("_", " "))).not.toBeInTheDocument();
  });

  it("counts down to the configured target", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));
    render(<ElementBody element={element("countdown", { target: "2026-07-23T12:01:05Z" })} />);
    expect(screen.getByLabelText(/0 days 0 hours 1 minutes 5 seconds/)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByLabelText(/0 days 0 hours 1 minutes 0 seconds/)).toBeInTheDocument();
  });

  it("creates a real QR SVG for static and dynamic destinations", () => {
    const { rerender } = render(<ElementBody element={element("qr_static", { value: "https://scena.test/check-in" })} />);
    expect(document.querySelector(".scena-editor__renderer-qr svg")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /QR code for https:\/\/scena.test\/check-in/ })).toBeInTheDocument();
    rerender(<ElementBody element={element("qr_dynamic", { target: "https://scena.test/live" })} />);
    expect(document.querySelector(".scena-editor__renderer-qr svg")).toBeInTheDocument();
  });

  it("renders a music player without a type-label placeholder", () => {
    render(<ElementBody element={element("music_player", { title: "Morning mix" })} />);
    expect(screen.getByText("Morning mix")).toBeInTheDocument();
    expect(screen.queryByText("music player")).not.toBeInTheDocument();
  });

  it.each([
    ["carousel", { images: ["https://example.test/slide.jpg"] }, /carousel slides/],
    ["video", { src: "https://example.test/video.mp4" }, /video preview/],
  ] as const)("renders %s without a type-label placeholder", (type, config, expected) => {
    render(<ElementBody element={element(type, config)} />);
    expect(screen.getByLabelText(expected)).toBeInTheDocument();
    expect(screen.queryByText(type.replace("_", " "))).not.toBeInTheDocument();
  });

  it("uses a safe visual when required config is absent", () => {
    render(<ElementBody element={element("qr_static")} />);
    expect(screen.getByText("Add a QR destination")).toBeInTheDocument();
    expect(screen.queryByText("qr static")).not.toBeInTheDocument();
  });

  it("renders resolved connected text without a preview-only badge", () => {
    render(<ElementBody element={element("data_text", { source_id: "source-1", source_key: "menu.title", resolved_value: "Lunch Menu" })} />);
    expect(screen.getByText("Lunch Menu")).toBeInTheDocument();
    expect(screen.queryByText(/preview/i)).not.toBeInTheDocument();
  });
});
