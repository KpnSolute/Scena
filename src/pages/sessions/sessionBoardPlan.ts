import type { DisplayMode } from "../../shared/validation";

export interface SessionBoardPlan {
  sessionBoardId: string;
  boardsByScreen: Record<string, string>;
}

/** Converts the wizard's visual routing choices into the persisted Session
 * fallback Board plus optional per-Display Board overrides. */
export function buildSessionBoardPlan(
  mode: DisplayMode,
  screenIds: string[],
  sharedBoardId: string,
  screenBoards: Record<string, string>,
): SessionBoardPlan {
  if (mode === "duplicate" || mode === "extend") {
    if (!sharedBoardId) throw new Error(`${mode} mode requires a Board.`);
    return { sessionBoardId: sharedBoardId, boardsByScreen: {} };
  }

  const boardsByScreen = Object.fromEntries(screenIds.map((screenId) => [screenId, screenBoards[screenId] ?? ""]));
  const missing = screenIds.find((screenId) => !boardsByScreen[screenId]);
  if (missing) throw new Error(`${mode} mode requires a Board for every Display.`);
  return {
    sessionBoardId: boardsByScreen[screenIds[0] ?? ""] ?? "",
    boardsByScreen,
  };
}
