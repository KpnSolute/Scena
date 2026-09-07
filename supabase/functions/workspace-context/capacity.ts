export type CapacityMetric = {
  used: number;
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
};

export function capacityMetric(
  usedValue: unknown,
  limitValue: unknown,
): CapacityMetric {
  const used = nonNegativeInteger(usedValue);
  const limit = limitValue === null || limitValue === undefined
    ? null
    : nonNegativeInteger(limitValue);
  return {
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    unlimited: limit === null,
  };
}

function nonNegativeInteger(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}
