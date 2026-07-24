// Shared building blocks for the per-type properties groups: a labelled
// segmented control (align/weight/etc.), numeric/color field wrappers that
// stay config-safe (never write NaN, always keep an accessible name), and
// the honest "no live data source" disclosure reused by weather / video /
// music_player / data_text.
import type { ReactNode } from "react";
import { Info } from "@phosphor-icons/react";
import { Field } from "../../ui/Field";
import { Input } from "../../ui/Input";
import { Button, IconButton } from "../../ui/Button";

/** Parses a numeric input's raw string, returning `undefined` (never NaN)
 * when the field is empty or the text isn't a finite number — callers skip
 * the config write in that case, so clearing a numeric field never patches
 * `config` with NaN. */
export function parseNumeric(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function clamp(value: number, min?: number, max?: number): number {
  let result = value;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

export interface NumberFieldProps {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onCommit: (value: number) => void;
}

/** A number Field that never writes NaN into config — clearing the input
 * simply doesn't commit until a finite value is typed again. */
export function NumberField({ label, hint, value, min, max, step, onCommit }: NumberFieldProps) {
  return (
    <Field label={label} hint={hint}>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          const parsed = parseNumeric(event.target.value);
          if (parsed !== undefined) onCommit(clamp(parsed, min, max));
        }}
      />
    </Field>
  );
}

export interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/** A labelled color swatch input. Wrapped in Field so the label is
 * associated with the control (Field clones its id onto the single child),
 * which gives the color input a real accessible name. */
export function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <Field label={label}>
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
        onChange={(event) => onChange(event.target.value)}
        style={{ width: 40, height: 32, border: "none", borderRadius: "var(--scena-radius-sm)", cursor: "pointer" }}
      />
    </Field>
  );
}

/** Visible label + hint that doesn't try to auto-associate via `htmlFor`
 * (Field's cloning targets a single form control; a Segmented group is
 * several buttons, so its accessible name comes from the group's own
 * `aria-label` instead). Reuses the existing `.scena-field` classes. */
export function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="scena-field">
      <span className="scena-field__label">{label}</span>
      {children}
      {hint && <span className="scena-field__hint">{hint}</span>}
    </div>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  "aria-label": string;
}

/** A keyboard-operable segmented control built from the existing Button /
 * IconButton primitives (real <button> elements, so Tab/Enter/Space work
 * for free) with `aria-pressed` marking the active option. Wraps instead of
 * scrolling if a group of options is too wide for the properties panel. */
export function Segmented<T extends string>({ value, options, onChange, "aria-label": ariaLabel }: SegmentedProps<T>) {
  return (
    <div className="scena-btn-group" role="group" aria-label={ariaLabel} style={{ flexWrap: "wrap" }}>
      {options.map((option) =>
        option.icon ? (
          <IconButton
            key={option.value}
            icon={option.icon}
            label={option.label}
            size="sm"
            active={value === option.value}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          />
        ) : (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={value === option.value ? "primary" : "secondary"}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ),
      )}
    </div>
  );
}

/** Calm, factual disclosure for the four element types with no live data
 * source in this product (weather / video / music_player / data_text) —
 * never implies live data is fetched today. */
export function NoDataSourceNote({ children }: { children: ReactNode }) {
  return (
    <p className="scena-field__hint" style={{ display: "flex", gap: 6, alignItems: "flex-start", margin: "0 0 12px" }}>
      <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
      <span>{children}</span>
    </p>
  );
}
