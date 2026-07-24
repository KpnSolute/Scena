// Renderer registry: ElementType -> presentational component. EditorCanvas
// looks a renderer up here instead of special-casing element types itself.
// `shape` is deliberately absent — EditorCanvas already renders shape
// geometry via its own SVG path (ShapeBody) and that must not regress.
import type { ComponentType } from "react";
import type { ElementType } from "../../../services/scena-api/boards";
import type { ElementRendererProps } from "./types";
import { TextElement } from "./TextElement";
import { ClockElement } from "./ClockElement";
import { DateElement } from "./DateElement";
import { CountdownElement } from "./CountdownElement";
import { TickerElement } from "./TickerElement";
import { QrElement } from "./QrElement";
import { MediaElement } from "./MediaElement";
import { CarouselElement } from "./CarouselElement";
import { WeatherElement } from "./WeatherElement";
import { VideoElement } from "./VideoElement";
import { MusicPlayerElement } from "./MusicPlayerElement";
import { DataTextElement } from "./DataTextElement";

export type { ElementRendererProps } from "./types";

export const ELEMENT_RENDERERS: Partial<Record<ElementType, ComponentType<ElementRendererProps>>> = {
  text: TextElement,
  image: MediaElement,
  asset_page: MediaElement,
  clock: ClockElement,
  date: DateElement,
  countdown: CountdownElement,
  qr_static: QrElement,
  qr_dynamic: QrElement,
  ticker: TickerElement,
  carousel: CarouselElement,
  weather: WeatherElement,
  video: VideoElement,
  music_player: MusicPlayerElement,
  data_text: DataTextElement,
};

export function getElementRenderer(type: ElementType): ComponentType<ElementRendererProps> | undefined {
  return ELEMENT_RENDERERS[type];
}
