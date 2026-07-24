// Border controls shared by every element type. border_width of 0 is the
// explicit "no border" state — surfaced as an unchecked "Add a border"
// checkbox rather than just an empty number box.
import type { BorderStyle, ElementBorderConfig } from "../../../services/scena-api/boards";
import { Field } from "../../ui/Field";
import { Checkbox } from "../../ui/Checkbox";
import { Select } from "../../ui/Select";
import { ColorField, NumberField } from "./shared";

const BORDER_STYLE_OPTIONS: { value: BorderStyle; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
];

export interface BorderGroupProps {
  border: ElementBorderConfig;
  updateConfig: (patch: Record<string, unknown>) => void;
}

export function BorderGroup({ border, updateConfig }: BorderGroupProps) {
  const hasBorder = border.border_width > 0;
  return (
    <div className="scena-editor__prop-group">
      <h4>Border</h4>
      <Checkbox
        label="Add a border"
        checked={hasBorder}
        onChange={(event) => updateConfig({ border_width: event.target.checked ? (hasBorder ? border.border_width : 2) : 0 })}
      />
      {hasBorder && (
        <>
          <div className="scena-editor__prop-row" style={{ marginTop: 10 }}>
            <NumberField label="Width" value={border.border_width} min={1} max={40} step={1} onCommit={(value) => updateConfig({ border_width: value })} />
            <Field label="Style">
              <Select
                aria-label="Border style"
                value={border.border_style}
                options={BORDER_STYLE_OPTIONS}
                onChange={(event) => updateConfig({ border_style: event.target.value })}
              />
            </Field>
          </div>
          <ColorField label="Color" value={border.border_color} onChange={(value) => updateConfig({ border_color: value })} />
        </>
      )}
    </div>
  );
}
