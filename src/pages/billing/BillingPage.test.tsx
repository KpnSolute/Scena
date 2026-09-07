import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BillingPage } from "./BillingPage";

const mockContext = vi.hoisted(() => ({
  workspace: {
    name: "Personal",
    type: "personal" as "personal" | "team",
    entitlements: {
      plan_code: "personal_free",
      max_displays: 2,
      max_boards: 5,
      max_members: 1,
      max_concurrent_sessions: 1,
    },
  },
}));

const mockCallEdgeFunction = vi.hoisted(() => vi.fn());

vi.mock("../../app/ManagerContextProvider", () => ({
  useManagerContext: () => mockContext,
}));

vi.mock("../../services/supabase/client", () => ({
  callEdgeFunction: mockCallEdgeFunction,
  requireSupabase: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockContext.workspace.name = "Personal";
  mockContext.workspace.type = "personal";
  mockContext.workspace.entitlements.plan_code = "personal_free";
});

describe("BillingPage", () => {
  it("explains that Personal Free has no billing portal", () => {
    render(<BillingPage />);

    expect(screen.queryByRole("button", { name: "Manage billing" })).not.toBeInTheDocument();
    expect(screen.getByText(/Personal Free has no subscription to manage/i)).toBeInTheDocument();
  });

  it("shows billing management for a paid Team Workspace", () => {
    mockContext.workspace.type = "team";
    mockContext.workspace.entitlements.plan_code = "plus";

    render(<BillingPage />);

    expect(screen.getByRole("button", { name: "Manage billing" })).toBeInTheDocument();
  });

  it("shows limited availability before opening checkout", () => {
    render(<BillingPage />);

    const plusCard = screen.getByText(/Plus Workspace/).closest("article") ?? screen.getByText(/Plus Workspace/).parentElement;
    expect(plusCard).toHaveTextContent(/Limited availability/i);
    fireEvent.click(screen.getAllByRole("button", { name: "Get started" })[1]);
    expect(screen.getByRole("dialog")).toHaveTextContent(/Limited availability/i);
  });

  it("renders Max unavailable with no actionable checkout", () => {
    render(<BillingPage />);

    const maxLabel = screen.getByText(/Max Workspace/);
    const maxCard = maxLabel.closest("article") ?? maxLabel.parentElement;
    expect(maxCard).toHaveTextContent(/Not yet available/i);
    expect(screen.getByRole("button", { name: "Coming later" })).toBeDisabled();
  });
});
