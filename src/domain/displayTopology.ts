export interface DisplayViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TopologyPreset = "duplicate" | "horizontal" | "vertical" | "grid";

export function clampViewport(viewport: DisplayViewport): DisplayViewport {
  const width = clamp(viewport.width, 12, 100);
  const height = clamp(viewport.height, 12, 100);
  return {
    x: clamp(viewport.x, 0, 100 - width),
    y: clamp(viewport.y, 0, 100 - height),
    width,
    height,
  };
}

export function topologyPreset(count: number, preset: TopologyPreset): DisplayViewport[] {
  if (count <= 0) return [];
  if (preset === "duplicate") return Array.from({ length: count }, () => ({ x: 10, y: 10, width: 80, height: 80 }));
  const columns = preset === "vertical" ? 1 : preset === "grid" ? Math.ceil(Math.sqrt(count)) : count;
  const rows = preset === "horizontal" ? 1 : Math.ceil(count / columns);
  const gap = 3;
  const width = (100 - gap * (columns + 1)) / columns;
  const height = (100 - gap * (rows + 1)) / rows;
  return Array.from({ length: count }, (_, index) => ({
    x: gap + (index % columns) * (width + gap),
    y: gap + Math.floor(index / columns) * (height + gap),
    width,
    height,
  }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
