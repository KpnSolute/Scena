import { describe, expect, it } from "vitest";
import { buildSessionBoardPlan } from "./sessionBoardPlan";

describe("buildSessionBoardPlan", () => {
  it("uses one Session Board for duplicate and extend", () => {
    expect(buildSessionBoardPlan("duplicate", ["display-1", "display-2"], "board-menu", {})).toEqual({
      sessionBoardId: "board-menu",
      boardsByScreen: {},
    });
  });

  it("keeps per-Display overrides and a safe Session fallback for independent mode", () => {
    expect(buildSessionBoardPlan("independent", ["display-1", "display-2"], "", {
      "display-1": "board-menu",
      "display-2": "board-promo",
    })).toEqual({
      sessionBoardId: "board-menu",
      boardsByScreen: {
        "display-1": "board-menu",
        "display-2": "board-promo",
      },
    });
  });

  it("rejects incomplete Board routing", () => {
    expect(() => buildSessionBoardPlan("single", ["display-1"], "", {})).toThrow("requires a Board for every Display");
  });
});
