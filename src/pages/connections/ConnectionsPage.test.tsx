import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionsPage } from "./ConnectionsPage";

const contentSources = vi.hoisted(() => ({
  list: vi.fn(),
  createWebhook: vi.fn(),
  createKpnSolute: vi.fn(),
  rotate: vi.fn(),
}));

vi.mock("../../app/ManagerContextProvider", () => ({
  useManagerContext: () => ({ workspace: { id: "workspace-1" } }),
}));

vi.mock("../../components/ui/Toast", () => ({
  useToast: () => ({ show: vi.fn() }),
}));

vi.mock("../../services/scena-api/contentSources", () => ({
  listContentSources: contentSources.list,
  createContentSource: contentSources.createWebhook,
  createKpnSoluteContentSource: contentSources.createKpnSolute,
  rotateContentSource: contentSources.rotate,
  contentSourceWebhookUrl: (sourceId: string) => `https://example.test/functions/v1/content-source?source_id=${sourceId}`,
}));

beforeEach(() => {
  vi.clearAllMocks();
  contentSources.list.mockResolvedValue([]);
  contentSources.createWebhook.mockResolvedValue({
    source: { id: "source-1", name: "POS menu", accepted_event_type: "menu.updated" },
    credential: {
      url: "https://example.test/functions/v1/content-source?source_id=source-1",
      source_id: "source-1",
      secret: "one-time-secret",
      headers: { authorization: "Bearer one-time-secret" },
      event_shape: {
        event_id: "unique-event-id",
        event_type: "menu.updated",
        occurred_at: "2026-09-07T12:00:00.000Z",
        data: { headline: "Live update", items: [] },
      },
    },
  });
});

describe("ConnectionsPage", () => {
  it("creates a provider-neutral webhook and reveals its unique address once", async () => {
    render(<ConnectionsPage />);

    await screen.findByText("No Connections yet");
    fireEvent.click(screen.getAllByRole("button", { name: "New connection" })[0]);
    fireEvent.click(screen.getByRole("combobox", { name: "Connection type" }));
    fireEvent.click(screen.getByRole("option", { name: "Incoming webhook" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Connection name" }), {
      target: { value: "POS menu" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Event type" }), {
      target: { value: "menu.updated" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create webhook" }));

    await waitFor(() => {
      expect(contentSources.createWebhook).toHaveBeenCalledWith(
        "workspace-1",
        "POS menu",
        "menu.updated",
      );
    });
    expect(await screen.findByRole("textbox", { name: "Webhook address" }))
      .toHaveValue("https://example.test/functions/v1/content-source?source_id=source-1");
    expect(screen.getByText(/cannot be viewed again/i)).toBeInTheDocument();
  });

  it("shows a stable webhook address on an existing generic connection", async () => {
    contentSources.list.mockResolvedValueOnce([{
      id: "source-2",
      workspace_id: "workspace-1",
      name: "Weather feed",
      source_type: "webhook",
      protocol: "legacy",
      status: "active",
      accepted_event_type: "weather.updated",
      accepted_event_types: ["weather.updated"],
      external_tenant_id: null,
      kpn_subscription_id: null,
      current_event_id: null,
      current_event_type: null,
      current_version: 0,
      last_received_at: null,
    }]);

    render(<ConnectionsPage />);

    expect(await screen.findByText("Incoming webhook")).toBeInTheDocument();
    expect(screen.getByText(/source_id=source-2/)).toBeInTheDocument();
  });
});
