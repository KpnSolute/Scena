// Typography controls shared by every text-bearing element type: text,
// clock, date, countdown, ticker, weather, data_text. Driven entirely by
// TextStyleConfig / readTextStyle from services/scena-api/boards.ts.
import type { ReactNode } from "react";
import { TextAlignLeft, TextAlignCenter, TextAlignRight, AlignTop, AlignCenterVertical, AlignBottom } from "@phosphor-icons/react";
import type { TextAlign, TextStyleConfig, VerticalAlign } from "../../../services/scena-api/boards";
import { FONT_WEIGHTS, FONT_FAMILY_TOKENS, TEXT_ALIGNS, VERTICAL_ALIGNS } from "../../../services/scena-api/boards";
import { Checkbox } from "../../ui/Checkbox";
import { FieldGroup, Segmented, NumberField, ColorField } from "./shared";

const ALIGN_ICONS: Record<TextAlign, ReactNode> = {
  left: <TextAlignLeft size={16} />,
  center: <TextAlignCenter size={16} />,
  right: <TextAlignRight size={16} />,
};

const VERTICAL_ALIGN_ICONS: Record<VerticalAlign, ReactNode> = {
  top: <AlignTop size={16} />,
  middle: <AlignCenterVertical size={16} />,
  bottom: <AlignBottom size={16} />,
};

export interface TypographyGroupProps {
  style: TextStyleConfig;
  updateConfig: (patch: Record<string, unknown>) => void;
}

export function TypographyGroup({ style, updateConfig }: TypographyGroupProps) {
  return (
    <div className="scena-editor__prop-group">
      <h4>Typography</h4>
      <div className="scena-editor__prop-row">
        <NumberField label="Font size" value={style.font_size} min={4} max={800} step={1} onCommit={(value) => updateConfig({ font_size: value })} />
        <NumberField label="Line height" value={style.line_height} min={0.5} max={4} step={0.1} onCommit={(value) => updateConfig({ line_height: value })} />
      </div>
      <FieldGroup label="Weight">
        <Segmented
          aria-label="Font weight"
          value={String(style.font_weight)}
          options={FONT_WEIGHTS.map((weight) => ({ value: String(weight), label: String(weight) }))}
          onChange={(value) => updateConfig({ font_weight: Number(value) })}
        />
      </FieldGroup>
      <FieldGroup label="Family">
        <Segmented
          aria-label="Font family"
          value={style.font_family}
          options={FONT_FAMILY_TOKENS.map((family) => ({ value: family, label: family[0].toUpperCase() + family.slice(1) }))}
          onChange={(value) => updateConfig({ font_family: value })}
        />
      </FieldGroup>
      <div className="scena-editor__prop-row">
        <FieldGroup label="Align">
          <Segmented
            aria-label="Horizontal align"
            value={style.align}
            options={TEXT_ALIGNS.map((align) => ({ value: align, label: align, icon: ALIGN_ICONS[align] }))}
            onChange={(value) => updateConfig({ align: value })}
          />
        </FieldGroup>
        <FieldGroup label="Vertical align">
          <Segmented
            aria-label="Vertical align"
            value={style.vertical_align}
            options={VERTICAL_ALIGNS.map((align) => ({ value: align, label: align, icon: VERTICAL_ALIGN_ICONS[align] }))}
            onChange={(value) => updateConfig({ vertical_align: value })}
          />
        </FieldGroup>
      </div>
      <ColorField label="Text color" value={style.color} onChange={(value) => updateConfig({ color: value })} />
      <div className="scena-editor__prop-row">
        <Checkbox label="Italic" checked={style.italic} onChange={(event) => updateConfig({ italic: event.target.checked })} />
        <Checkbox label="Underline" checked={style.underline} onChange={(event) => updateConfig({ underline: event.target.checked })} />
      </div>
      <Checkbox
        label="Background fill"
        checked={Boolean(style.background)}
        onChange={(event) => updateConfig({ background: event.target.checked ? style.background || "#000000" : "" })}
      />
      {style.background && <ColorField label="Background color" value={style.background} onChange={(value) => updateConfig({ background: value })} />}
    </div>
  );
}
