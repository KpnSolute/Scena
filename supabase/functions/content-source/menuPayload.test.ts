import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  combineMenuBootstrap,
  MENU_CYCLE_EVENT,
  MENU_DAY_EVENT,
  normalizeKpnMenuEvent,
} from "./menuPayload.ts";

const today = {
  date: "2026-09-07",
  cycle_day: 3,
  cycle_week: 1,
  day_of_week: "Monday",
  meals: {
    Breakfast: [{ slot_name: "Main", item_name: "Waffles" }],
    Lunch: [{ slot_name: "Entree", item_name: "Pasta" }],
  },
};

const cycle = {
  anchor_date: "2026-09-05",
  days: [{ cycle_day: 3, day_of_week: "Monday", meals: today.meals }],
};

Deno.test("normalizes day events into display-ready menu paths", () => {
  assertEquals(normalizeKpnMenuEvent(MENU_DAY_EVENT, today), {
    menu: {
      title: "Monday Menu",
      date: "2026-09-07",
      cycle_day: 3,
      cycle_week: 1,
      sections: [
        { title: "Breakfast", items: [{ name: "Waffles", slot: "Main" }] },
        { title: "Lunch", items: [{ name: "Pasta", slot: "Entree" }] },
      ],
      service_status: null,
    },
    provider: { product: "kpncompute", feed: "menu" },
  });
});

Deno.test("normalizes cycle events without erasing today's menu", () => {
  const payload = combineMenuBootstrap(today, cycle);
  assertEquals((payload.menu as Record<string, unknown>).title, "Monday Menu");
  assertEquals(
    (payload.cycle as Record<string, unknown>).anchor_date,
    "2026-09-05",
  );
  assertEquals(
    ((payload.cycle as Record<string, unknown>).days as unknown[]).length,
    1,
  );
  assertEquals(normalizeKpnMenuEvent(MENU_CYCLE_EVENT, cycle), {
    cycle: {
      anchor_date: "2026-09-05",
      days: [{
        cycle_day: 3,
        day_of_week: "Monday",
        sections: [
          { title: "Breakfast", items: [{ name: "Waffles", slot: "Main" }] },
          { title: "Lunch", items: [{ name: "Pasta", slot: "Entree" }] },
        ],
        feedback: [],
      }],
    },
    provider: { product: "kpncompute", feed: "menu" },
  });
});

Deno.test("rejects malformed provider payloads", () => {
  assertThrows(() => normalizeKpnMenuEvent(MENU_DAY_EVENT, { meals: [] }));
  assertThrows(() => normalizeKpnMenuEvent(MENU_CYCLE_EVENT, { days: [] }));
  assertThrows(() => normalizeKpnMenuEvent("unknown", {}));
});
