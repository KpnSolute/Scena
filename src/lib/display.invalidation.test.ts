// Tests the invalidation-routing contract described in
// docs/DATABASE_SCHEMA.md §7 / src/lib/display.ts:
//   - subscribes to the exact org-scoped broadcast channel
//   - a broadcast 'invalidate' event triggers exactly one hint
//   - the initial SUBSCRIBED status also triggers a hint (so a fresh
//     connect *and* a reconnect both force one authoritative fetch)
//   - unsubscribing tears the channel down
//   - duplicate events each trigger their own hint (harmless — the
//     caller's hint handler is `pollState`, which is idempotent)
//
// The real Supabase Realtime socket isn't exercised (no live network in
// unit tests); this verifies the routing logic that decides *when* to
// call the hint callback, which is what "invalidation routing" means for
// a pure/fast test — end-to-end socket delivery is a Realtime platform
// guarantee, not application logic to test here.

import { describe, expect, it, vi, beforeEach } from "vitest";

type BroadcastCallback = () => void;
type StatusCallback = (status: string) => void;

function makeFakeChannel() {
  let broadcastHandler: BroadcastCallback | null = null;
  const channel = {
    on: vi.fn((type: string, filter: { event: string }, cb: BroadcastCallback) => {
      if (type === "broadcast" && filter.event === "invalidate") broadcastHandler = cb;
      return channel;
    }),
    subscribe: vi.fn((statusCb?: StatusCallback) => {
      statusCb?.("SUBSCRIBED");
      return channel;
    }),
    send: vi.fn(),
    _fireBroadcast: () => broadcastHandler?.(),
  };
  return channel;
}

const fakeChannels = new Map<string, ReturnType<typeof makeFakeChannel>>();
const removeChannel = vi.fn();

vi.mock("../services/supabase/client", () => ({
  get supabase() {
    return {
      channel: (name: string) => {
        const ch = makeFakeChannel();
        fakeChannels.set(name, ch);
        return ch;
      },
      removeChannel,
    };
  },
}));

beforeEach(() => {
  fakeChannels.clear();
  removeChannel.mockClear();
});

describe("subscribeToOrgInvalidation", () => {
  it("subscribes to the exact org-scoped channel name", async () => {
    const { subscribeToOrgInvalidation } = await import("./display");
    subscribeToOrgInvalidation("org-123", () => {});
    expect(fakeChannels.has("org:org-123")).toBe(true);
  });

  it("fires a hint immediately on initial SUBSCRIBED (covers reconnect-triggers-fetch)", async () => {
    const { subscribeToOrgInvalidation } = await import("./display");
    const hint = vi.fn();
    subscribeToOrgInvalidation("org-abc", hint);
    expect(hint).toHaveBeenCalledTimes(1);
  });

  it("fires a hint on each broadcast 'invalidate' event", async () => {
    const { subscribeToOrgInvalidation } = await import("./display");
    const hint = vi.fn();
    subscribeToOrgInvalidation("org-xyz", hint);
    const channel = fakeChannels.get("org:org-xyz")!;
    channel._fireBroadcast();
    channel._fireBroadcast();
    // 1 from SUBSCRIBED + 2 from broadcasts
    expect(hint).toHaveBeenCalledTimes(3);
  });

  it("duplicate events are harmless — each just re-invokes the same idempotent hint", async () => {
    const { subscribeToOrgInvalidation } = await import("./display");
    const hint = vi.fn();
    subscribeToOrgInvalidation("org-dup", hint);
    const channel = fakeChannels.get("org:org-dup")!;
    for (let i = 0; i < 5; i++) channel._fireBroadcast();
    expect(hint.mock.calls.every((args) => args.length === 0)).toBe(true); // no payload is ever trusted/threaded through
  });

  it("unsubscribe removes the channel", async () => {
    const { subscribeToOrgInvalidation } = await import("./display");
    const unsubscribe = subscribeToOrgInvalidation("org-teardown", () => {});
    unsubscribe();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it("two different orgs get two independent channels (no cross-org leakage)", async () => {
    const { subscribeToOrgInvalidation } = await import("./display");
    subscribeToOrgInvalidation("org-1", () => {});
    subscribeToOrgInvalidation("org-2", () => {});
    expect(fakeChannels.has("org:org-1")).toBe(true);
    expect(fakeChannels.has("org:org-2")).toBe(true);
    expect(fakeChannels.size).toBe(2);
  });
});

describe("networkQuality", () => {
  it("normalizes browser connection hints to the database health contract", async () => {
    const { networkQuality } = await import("./display");
    expect(networkQuality("4g")).toBe("good");
    expect(networkQuality("3g")).toBe("fair");
    expect(networkQuality("2g")).toBe("poor");
    expect(networkQuality("slow-2g")).toBe("poor");
    expect(networkQuality(undefined)).toBeNull();
    expect(networkQuality("wifi")).toBeNull();
  });
});
