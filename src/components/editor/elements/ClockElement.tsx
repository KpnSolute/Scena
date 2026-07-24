import { readClockConfig } from "../../../services/scena-api/boards";
import { textFrameStyle, textRunStyle, useTick } from "./shared";
import type { ElementRendererProps } from "./types";

export function ClockElement({ element, scale }: ElementRendererProps) {
  const config = readClockConfig(element);
  // Tick once a second only while seconds are actually shown — otherwise a
  // minutes-only clock re-renders 59 times for nothing every minute.
  const now = useTick(config.show_seconds ? 1000 : 60_000);
  const timeZone = config.timezone || undefined;

  const formatted = formatClock(now, config.time_format === "12h", config.show_seconds, timeZone);

  return (
    <div className="scena-editor__renderer-frame" style={textFrameStyle(config)}>
      {/* Not aria-live: a per-second ticker must not spam screen readers. */}
      <span className="scena-editor__renderer-clock" aria-label={`Current time ${formatted}`} style={textRunStyle(config, scale)}>
        {formatted}
      </span>
    </div>
  );
}

function formatClock(now: Date, hour12: boolean, showSeconds: boolean, timeZone: string | undefined): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    second: showSeconds ? "2-digit" : undefined,
    hour12,
    timeZone,
  };
  try {
    return new Intl.DateTimeFormat(undefined, options).format(now);
  } catch {
    // An invalid/unsupported IANA zone string: fall back to the viewer's
    // local zone rather than rendering a blank clock.
    return new Intl.DateTimeFormat(undefined, { ...options, timeZone: undefined }).format(now);
  }
}
