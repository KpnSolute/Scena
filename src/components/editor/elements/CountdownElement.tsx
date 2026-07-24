import { readCountdownConfig, type CountdownUnits } from "../../../services/scena-api/boards";
import { textFrameStyle, textRunStyle, useTick } from "./shared";
import type { ElementRendererProps } from "./types";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

interface CountdownUnit { value: number; label: string }

function splitRemaining(totalSeconds: number, units: CountdownUnits): CountdownUnit[] {
  if (units === "hms") {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return [{ value: hours, label: "hrs" }, { value: minutes, label: "min" }, { value: totalSeconds % 60, label: "sec" }];
  }
  if (units === "ms") {
    const minutes = Math.floor(totalSeconds / 60);
    return [{ value: minutes, label: "min" }, { value: totalSeconds % 60, label: "sec" }];
  }
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return [
    { value: days, label: "days" },
    { value: hours, label: "hrs" },
    { value: minutes, label: "min" },
    { value: totalSeconds % 60, label: "sec" },
  ];
}

export function CountdownElement({ element, scale }: ElementRendererProps) {
  const config = readCountdownConfig(element);
  const now = useTick(1000);

  if (!config.target) {
    return (
      <div className="scena-editor__renderer-frame" style={textFrameStyle(config)}>
        <span className="scena-editor__renderer-fallback">Set a countdown target</span>
      </div>
    );
  }

  const targetMs = Date.parse(config.target);
  if (Number.isNaN(targetMs)) {
    return (
      <div className="scena-editor__renderer-frame" style={textFrameStyle(config)}>
        <span className="scena-editor__renderer-fallback">Invalid countdown target</span>
      </div>
    );
  }

  const remainingMs = targetMs - now.getTime();
  if (remainingMs <= 0) {
    return (
      <div className="scena-editor__renderer-frame" style={textFrameStyle(config)}>
        <span className="scena-editor__renderer-countdown-expired" style={textRunStyle(config, scale)}>
          {config.expired_text}
        </span>
      </div>
    );
  }

  const units = splitRemaining(Math.floor(remainingMs / 1000), config.units);
  const ariaLabel = `${units.map((unit) => `${unit.value} ${unit.label}`).join(" ")} remaining`;

  return (
    <div className="scena-editor__renderer-frame" style={textFrameStyle(config)}>
      <div
        className="scena-editor__renderer-countdown"
        aria-label={ariaLabel}
        style={textRunStyle(config, scale)}
      >
        {units.map((unit) => (
          <span key={unit.label} className="scena-editor__renderer-countdown-unit">
            <strong>{pad(unit.value)}</strong>
            {config.show_labels && <small>{unit.label}</small>}
          </span>
        ))}
      </div>
    </div>
  );
}
