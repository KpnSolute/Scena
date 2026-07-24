import { readDateConfig, type DateFormat } from "../../../services/scena-api/boards";
import { textFrameStyle, textRunStyle, useTick } from "./shared";
import type { ElementRendererProps } from "./types";

const FORMAT_OPTIONS: Record<Exclude<DateFormat, "iso">, Intl.DateTimeFormatOptions> = {
  long: { weekday: "long", year: "numeric", month: "long", day: "numeric" },
  medium: { year: "numeric", month: "short", day: "numeric" },
  short: { year: "2-digit", month: "numeric", day: "numeric" },
  weekday: { weekday: "long" },
};

export function DateElement({ element, scale }: ElementRendererProps) {
  const config = readDateConfig(element);
  const now = useTick(60_000);
  const timeZone = config.timezone || undefined;

  const formatted = formatDate(now, config.date_format, timeZone);

  return (
    <div className="scena-editor__renderer-frame" style={textFrameStyle(config)}>
      <span className="scena-editor__renderer-date" aria-label={`Current date ${formatted}`} style={textRunStyle(config, scale)}>
        {formatted}
      </span>
    </div>
  );
}

function formatDate(now: Date, format: DateFormat, timeZone: string | undefined): string {
  try {
    if (format === "iso") {
      // en-CA renders as YYYY-MM-DD, which is exactly ISO 8601's date part.
      return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).format(now);
    }
    return new Intl.DateTimeFormat(undefined, { ...FORMAT_OPTIONS[format], timeZone }).format(now);
  } catch {
    return format === "iso"
      ? new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
      : new Intl.DateTimeFormat(undefined, FORMAT_OPTIONS[format]).format(now);
  }
}
