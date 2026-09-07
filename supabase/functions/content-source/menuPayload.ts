export const MENU_DAY_EVENT = "com.kpnsolute.compute.menu.day.updated.v1";
export const MENU_CYCLE_EVENT = "com.kpnsolute.compute.menu.cycle.updated.v1";
export const KPN_MENU_EVENT_TYPES = [MENU_DAY_EVENT, MENU_CYCLE_EVENT] as const;

export class MenuPayloadError extends Error {}

type JsonObject = Record<string, unknown>;

export function normalizeKpnMenuEvent(
  eventType: string,
  value: unknown,
): JsonObject {
  if (eventType === MENU_DAY_EVENT) return normalizeMenuDay(value);
  if (eventType === MENU_CYCLE_EVENT) return normalizeMenuCycle(value);
  throw new MenuPayloadError(`Unsupported KpnCompute menu event: ${eventType}`);
}

export function normalizeMenuDay(value: unknown): JsonObject {
  const day = object(value, "menu day");
  const meals = object(day.meals, "menu day meals");
  const sections = Object.entries(meals).map(([title, rawItems]) => ({
    title,
    items: array(rawItems, `${title} items`).map((rawItem) => {
      const item = object(rawItem, `${title} item`);
      return {
        name: requiredText(item.item_name, "item_name"),
        slot: optionalText(item.slot_name),
      };
    }),
  }));

  return {
    menu: {
      title: `${optionalText(day.day_of_week) ?? "Today"} Menu`,
      date: optionalText(day.date),
      cycle_day: optionalInteger(day.cycle_day),
      cycle_week: optionalInteger(day.cycle_week),
      sections,
      service_status: isObject(day.service_status) ? day.service_status : null,
    },
    provider: {
      product: "kpncompute",
      feed: "menu",
    },
  };
}

export function normalizeMenuCycle(value: unknown): JsonObject {
  const cycle = object(value, "menu cycle");
  const days = array(cycle.days, "menu cycle days").map((rawDay) => {
    const day = object(rawDay, "menu cycle day");
    const normalized = normalizeMenuDay(day).menu as JsonObject;
    return {
      cycle_day: requiredInteger(day.cycle_day, "cycle_day"),
      day_of_week: requiredText(day.day_of_week, "day_of_week"),
      sections: normalized.sections,
      feedback: Array.isArray(day.feedback) ? day.feedback : [],
    };
  });
  if (days.length === 0) {
    throw new MenuPayloadError("menu cycle days must not be empty");
  }

  return {
    cycle: {
      anchor_date: optionalText(cycle.anchor_date),
      days,
    },
    provider: {
      product: "kpncompute",
      feed: "menu",
    },
  };
}

export function combineMenuBootstrap(
  today: unknown,
  cycle: unknown,
): JsonObject {
  return {
    ...normalizeMenuDay(today),
    ...normalizeMenuCycle(cycle),
  };
}

function object(value: unknown, name: string): JsonObject {
  if (!isObject(value)) throw new MenuPayloadError(`${name} must be an object`);
  return value;
}

function array(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new MenuPayloadError(`${name} must be an array`);
  }
  return value;
}

function requiredText(value: unknown, name: string): string {
  const parsed = optionalText(value);
  if (!parsed) throw new MenuPayloadError(`${name} is required`);
  return parsed;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredInteger(value: unknown, name: string): number {
  const parsed = optionalInteger(value);
  if (parsed === null) throw new MenuPayloadError(`${name} must be an integer`);
  return parsed;
}

function optionalInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
