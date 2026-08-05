import { describe, expect, it } from "vitest";
import {
  SESSION_STATES,
  canTransition,
  holdsDisplays,
  sessionEventLabel,
  sessionStateLabel,
  startTransitionPath,
  stopTransitionPath,
  type SessionState,
} from "./sessionControl";

/**
 * These tests guard the agreement between the client-side transition table and
 * private.session_transition_allowed(). If the database changes, these fail —
 * which is the point. The SQL side is covered by
 * supabase/tests/session_platform_tests.sql.
 */

// Transcribed from private.session_transition_allowed(). Keep in step.
const DB_TRANSITIONS: Record<SessionState, SessionState[]> = {
  draft: ["ready", "archived"],
  ready: ["draft", "starting", "archived"],
  starting: ["active", "failed", "stopping"],
  active: ["degraded", "paused", "stopping", "failed"],
  degraded: ["active", "paused", "stopping", "failed"],
  paused: ["active", "stopping", "failed"],
  stopping: ["stopped", "failed"],
  stopped: ["ready", "archived"],
  failed: ["ready", "stopping", "stopped", "archived"],
  archived: [],
};

describe("session lifecycle transition table", () => {
  it("matches the database transition table exactly", () => {
    for (const from of SESSION_STATES) {
      const allowed = SESSION_STATES.filter((to) => to !== from && canTransition(from, to));
      expect(allowed.slice().sort()).toEqual(DB_TRANSITIONS[from].slice().sort());
    }
  });

  it("treats archived as terminal", () => {
    for (const to of SESSION_STATES) {
      expect(canTransition("archived", to)).toBe(false);
    }
  });

  it("never allows draft to jump straight to a live state", () => {
    expect(canTransition("draft", "active")).toBe(false);
    expect(canTransition("draft", "starting")).toBe(false);
    expect(canTransition("draft", "stopped")).toBe(false);
  });

  it("routes recovery from failed through ready, never straight to active", () => {
    expect(canTransition("failed", "ready")).toBe(true);
    expect(canTransition("failed", "active")).toBe(false);
  });
});

describe("holdsDisplays", () => {
  it("counts every state that still owns its Displays", () => {
    const holding = SESSION_STATES.filter(holdsDisplays);
    expect(holding.slice().sort()).toEqual(["active", "degraded", "paused", "starting"]);
  });

  it("counts paused as holding, so it consumes concurrent-Session capacity", () => {
    // A paused Session has not released its screens. Treating it as free
    // capacity would let a one-Session plan hold two Sessions' Displays.
    expect(holdsDisplays("paused")).toBe(true);
  });

  it("does not count terminal or pre-live states", () => {
    expect(holdsDisplays("draft")).toBe(false);
    expect(holdsDisplays("ready")).toBe(false);
    expect(holdsDisplays("stopped")).toBe(false);
    expect(holdsDisplays("archived")).toBe(false);
  });
});

describe("lifecycle paths", () => {
  it("starts drafts and restarts stopped or failed Sessions through every required gate", () => {
    for (const state of ["draft", "stopped", "failed"] as const) {
      expect(startTransitionPath(state)).toEqual(["ready", "starting", "active"]);
    }
  });

  it("starts ready Sessions and resumes paused Sessions without illegal jumps", () => {
    expect(startTransitionPath("ready")).toEqual(["starting", "active"]);
    expect(startTransitionPath("paused")).toEqual(["active"]);
    expect(startTransitionPath("active")).toEqual([]);
  });

  it("stops every state that can still own Displays through stopping", () => {
    for (const state of ["starting", "active", "degraded", "paused", "failed"] as const) {
      expect(stopTransitionPath(state)).toEqual(["stopping", "stopped"]);
    }
    expect(stopTransitionPath("draft")).toEqual([]);
  });

  it("contains only database-allowed hops across a complete operating cycle", () => {
    const cycle: SessionState[] = [
      "draft",
      ...startTransitionPath("draft"),
      "paused",
      ...startTransitionPath("paused"),
      ...stopTransitionPath("active"),
    ];
    for (let index = 0; index < cycle.length - 1; index += 1) {
      expect(canTransition(cycle[index], cycle[index + 1])).toBe(true);
    }
    expect(cycle).toEqual(["draft", "ready", "starting", "active", "paused", "active", "stopping", "stopped"]);
  });
});

describe("labels", () => {
  it("gives every lifecycle state a human label", () => {
    for (const state of SESSION_STATES) {
      expect(sessionStateLabel(state)).not.toBe(state);
      expect(sessionStateLabel(state).length).toBeGreaterThan(0);
    }
  });

  it("falls back to the raw value for an unknown state rather than throwing", () => {
    expect(sessionStateLabel("something_new")).toBe("something_new");
    expect(sessionEventLabel("session.unheard_of")).toBe("session.unheard_of");
  });

  it("labels the lifecycle event types the timeline renders", () => {
    expect(sessionEventLabel("session.started")).toBe("Session started");
    expect(sessionEventLabel("screen.sync_failed")).toBe("Display sync failed");
    expect(sessionEventLabel("automation.executed")).toBe("Automation ran");
  });
});
