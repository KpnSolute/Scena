import { CloudSun } from "@phosphor-icons/react";
import { readWeatherConfig } from "../../../services/scena-api/boards";
import { PreviewBadge, textFrameStyle, textRunStyle } from "./shared";
import type { ElementRendererProps } from "./types";

// Weather has no live data source in this product (no forecast provider is
// wired up) — this renders a configuration preview only. It must never show
// an invented temperature or condition as though it were real.
export function WeatherElement({ element, scale }: ElementRendererProps) {
  const config = readWeatherConfig(element);
  // "--" reads unambiguously as "no reading yet" — never a real temperature.
  const placeholderTemp = config.units === "metric" ? "--°C" : "--°F";

  return (
    <div className="scena-editor__renderer-frame scena-editor__renderer-frame--column" style={textFrameStyle(config)}>
      <div className="scena-editor__renderer-weather">
        <CloudSun className="scena-editor__renderer-weather-icon" aria-hidden="true" />
        <span style={textRunStyle(config, scale)}>
          <strong>{placeholderTemp}</strong>
          {config.show_condition && <small>Condition pending</small>}
          <em>{config.location || "No location set"}</em>
        </span>
      </div>
      <PreviewBadge />
    </div>
  );
}
