import { useEffect, useMemo, useState } from "react";
import qrcode from "qrcode-generator";
import type { SceneElement } from "../../services/scena-api/boards";

type ElementConfig = Record<string, unknown>;

export interface ElementBodyProps {
  element: SceneElement;
  assetUrl?: string;
  runtimeData?: Record<string, unknown>;
}

/**
 * Preview renderers for elements which are also rendered by the player.
 * These are deliberately local: the editor should remain useful when a live
 * data source, media upload, or external integration is unavailable.
 */
export function ElementBody({ element, assetUrl, runtimeData }: ElementBodyProps) {
  const config = element.config ?? {};
  switch (element.element_type) {
    case "text": return <TextBody config={config} />;
    case "image":
    case "asset_page": return <ImageBody config={config} assetUrl={assetUrl} />;
    case "clock": return <ClockBody config={config} />;
    case "date": return <DateBody config={config} />;
    case "countdown": return <CountdownBody config={config} />;
    case "qr_static":
    case "qr_dynamic": return <QrBody config={config} dynamic={element.element_type === "qr_dynamic"} />;
    case "music_player": return <MusicPlayerBody config={config} />;
    case "ticker": return <TickerBody config={config} />;
    case "carousel": return <CarouselBody config={config} />;
    case "video": return <VideoBody config={config} />;
    case "weather": return <WeatherBody config={{ ...config, ...(runtimeData ?? {}) }} />;
    case "data_text": return <DataTextBody config={config} />;
    default: return <FallbackBody message="Add content to preview" />;
  }
}

function TextBody({ config }: { config: ElementConfig }) {
  return <span className="scena-editor__renderer-text">{stringValue(config.text) || "Text"}</span>;
}

function ImageBody({ config, assetUrl }: { config: ElementConfig; assetUrl?: string }) {
  const src = assetUrl || stringValue(config.src) || stringValue(config.url);
  if (!src) return <FallbackBody message="Choose an image" />;
  return <img className="scena-editor__renderer-image" src={src} alt={stringValue(config.alt) || "Board asset"} draggable={false} />;
}

function ClockBody({ config }: { config: ElementConfig }) {
  const now = useTicker();
  const locale = stringValue(config.locale) || undefined;
  const timeZone = normalizedTimeZone(config);
  const value = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone }).format(now);
  return <span className="scena-editor__renderer-clock" aria-label={`Current time ${value}`}>{value}</span>;
}

function DateBody({ config }: { config: ElementConfig }) {
  const now = useTicker();
  const locale = stringValue(config.locale) || undefined;
  const timeZone = normalizedTimeZone(config);
  const value = new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone }).format(now);
  return <span className="scena-editor__renderer-date" aria-label={`Current date ${value}`}>{value}</span>;
}

function CountdownBody({ config }: { config: ElementConfig }) {
  const target = parseDate(config.target) || parseDate(config.end_at) || parseDate(config.endsAt);
  const now = useTicker();
  if (!target) return <FallbackBody message="Set a countdown end time" />;
  const remaining = Math.max(0, target.getTime() - now.getTime());
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return (
    <div className="scena-editor__renderer-countdown" aria-label={`${days} days ${hours} hours ${minutes} minutes ${seconds} seconds remaining`}>
      {days > 0 && <CountdownUnit value={days} label="days" />}
      <CountdownUnit value={hours} label="hrs" />
      <CountdownUnit value={minutes} label="min" />
      <CountdownUnit value={seconds} label="sec" />
    </div>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return <span className="scena-editor__renderer-countdown-unit"><strong>{String(value).padStart(2, "0")}</strong><small>{label}</small></span>;
}

function QrBody({ config, dynamic }: { config: ElementConfig; dynamic: boolean }) {
  const value = stringValue(config.value) || stringValue(config.url) || stringValue(config.target) || stringValue(config.text);
  const svg = useMemo(() => {
    if (!value) return null;
    try {
      const code = qrcode(0, "M");
      code.addData(value);
      code.make();
      return code.createSvgTag({ cellSize: 1, margin: 2, scalable: true });
    } catch {
      return null;
    }
  }, [value]);
  if (!svg) return <FallbackBody message={dynamic ? "Connect a QR destination" : "Add a QR destination"} />;
  return <div className="scena-editor__renderer-qr" role="img" aria-label={`QR code for ${value}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

function MusicPlayerBody({ config }: { config: ElementConfig }) {
  const src = stringValue(config.src) || stringValue(config.url) || stringValue(config.audio_url);
  const title = stringValue(config.title) || "Untitled track";
  const artist = stringValue(config.artist) || stringValue(config.subtitle) || "Scena audio";
  return (
    <div className="scena-editor__renderer-player">
      <span className="scena-editor__renderer-player-icon" aria-hidden="true">♪</span>
      <span className="scena-editor__renderer-player-copy"><strong>{title}</strong><small>{artist}</small></span>
      {src ? <audio controls preload="metadata" src={src} aria-label={`Play ${title}`} /> : <span className="scena-editor__renderer-player-status">Preview track</span>}
    </div>
  );
}

function TickerBody({ config }: { config: ElementConfig }) {
  const text = stringValue(config.text) || stringValue(config.message) || stringValue(config.content) || "Add ticker content";
  return <div className="scena-editor__renderer-ticker"><span>{text}</span><span aria-hidden="true">{text}</span></div>;
}

function CarouselBody({ config }: { config: ElementConfig }) {
  const slides = arrayValues(config.images || config.slides || config.items);
  const first = slides[0];
  const src = typeof first === "string" ? first : first && (stringValue(first.src) || stringValue(first.url));
  if (!src) return <FallbackBody message="Add carousel media" />;
  return (
    <div className="scena-editor__renderer-carousel">
      <img src={src} alt={typeof first === "string" ? "Carousel slide" : stringValue(first?.alt) || "Carousel slide"} draggable={false} />
      <span className="scena-editor__renderer-carousel-dots" aria-label={`${slides.length} carousel slides`}>{slides.map((_, index) => <i key={index} className={index === 0 ? "is-active" : ""} />)}</span>
    </div>
  );
}

function VideoBody({ config }: { config: ElementConfig }) {
  const src = stringValue(config.src) || stringValue(config.url) || stringValue(config.video_url);
  const poster = stringValue(config.poster);
  if (!src) return <FallbackBody message="Choose a video" />;
  return <video className="scena-editor__renderer-video" controls muted playsInline poster={poster || undefined} src={src} aria-label="Board video preview" />;
}

function WeatherBody({ config }: { config: ElementConfig }) {
  const location = stringValue(config.location) || stringValue(config.city) || "Local forecast";
  const temperature = stringValue(config.temperature) || stringValue(config.temp);
  const condition = stringValue(config.condition) || stringValue(config.summary);
  return (
    <div className="scena-editor__renderer-weather">
      <span className="scena-editor__renderer-weather-icon" aria-hidden="true">{stringValue(config.icon) || "☀"}</span>
      <span><strong>{temperature || "--°"}</strong><small>{condition || "Forecast unavailable"}</small><em>{location}</em></span>
    </div>
  );
}

function normalizedTimeZone(config: ElementConfig): string | undefined {
  const value = stringValue(config.time_zone) || stringValue(config.timeZone) || stringValue(config.timezone);
  return value && value !== "local" ? value : undefined;
}

function DataTextBody({ config }: { config: ElementConfig }) {
  const value = config.resolved_value ?? config.value ?? config.text ?? config.content ?? config.data;
  return <span className="scena-editor__renderer-data-text">{value === undefined || value === null || value === "" ? "No data connected" : String(value)}</span>;
}

function FallbackBody({ message }: { message: string }) {
  return <span className="scena-editor__renderer-fallback">{message}</span>;
}

function useTicker(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : typeof value === "number" ? String(value) : undefined;
}

function parseDate(value: unknown): Date | undefined {
  const text = stringValue(value);
  if (!text) return undefined;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function arrayValues(value: unknown): Array<string | ElementConfig> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string | ElementConfig => typeof item === "string" || Boolean(item && typeof item === "object"));
}
