import { CaretDown, Check } from "@phosphor-icons/react";
import { forwardRef, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ButtonHTMLAttributes, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectChangeEvent {
  target: { value: string };
  currentTarget: { value: string };
}

export interface SelectProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "defaultValue" | "onChange" | "value"> {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  name?: string;
  onChange?: (event: SelectChangeEvent) => void;
}

interface PopoverPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { options, className, value, defaultValue = "", name, onChange, disabled, id, onKeyDown, ...rest },
  forwardedRef,
) {
  const generatedId = useId();
  const controlId = id ?? `scena-select-${generatedId}`;
  const listboxId = `${controlId}-listbox`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const selectedValue = value ?? internalValue;
  const selectedOption = useMemo(() => options.find((option) => option.value === selectedValue), [options, selectedValue]);

  function setTriggerRef(node: HTMLButtonElement | null) {
    triggerRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }

  function positionPopover() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 12;
    const availableBelow = window.innerHeight - rect.bottom - margin;
    const availableAbove = rect.top - margin;
    const maxHeight = Math.max(160, Math.min(320, Math.max(availableBelow, availableAbove)));
    const opensAbove = availableBelow < 190 && availableAbove > availableBelow;
    setPosition({
      left: Math.min(Math.max(margin, rect.left), Math.max(margin, window.innerWidth - rect.width - margin)),
      top: opensAbove ? Math.max(margin, rect.top - maxHeight - 8) : rect.bottom + 8,
      width: rect.width,
      maxHeight,
    });
  }

  useEffect(() => {
    if (!open) return;
    positionPopover();
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if ([...optionRefs.current.values()].some((option) => option.contains(target))) return;
      setOpen(false);
    };
    const reposition = () => positionPopover();
    document.addEventListener("pointerdown", close);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const target = optionRefs.current.get(selectedValue) ?? optionRefs.current.get(options.find((option) => !option.disabled)?.value ?? "");
    target?.focus();
  }, [open, options, selectedValue]);

  function choose(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue);
    const event = { target: { value: nextValue }, currentTarget: { value: nextValue } };
    onChange?.(event);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function moveFrom(currentValue: string, delta: number) {
    const enabled = options.filter((option) => !option.disabled);
    if (!enabled.length) return;
    const currentIndex = Math.max(0, enabled.findIndex((option) => option.value === currentValue));
    enabled[(currentIndex + delta + enabled.length) % enabled.length]?.value &&
      optionRefs.current.get(enabled[(currentIndex + delta + enabled.length) % enabled.length].value)?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
    }
  }

  return (
    <span className="scena-select-shell">
      {name ? <input type="hidden" name={name} value={selectedValue} /> : null}
      <button
        {...rest}
        ref={setTriggerRef}
        id={controlId}
        type="button"
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={selectedValue ? `${listboxId}-${selectedValue}` : undefined}
        className={cx("scena-select", className)}
        data-open={open}
        data-placeholder={!selectedOption || !selectedValue}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span>{selectedOption?.label ?? options[0]?.label ?? "Choose an option"}</span>
        <CaretDown className="scena-select__caret" size={15} weight="bold" aria-hidden="true" />
      </button>

      {open && position ? createPortal(
        <div
          id={listboxId}
          role="listbox"
          className="scena-select-popover scena-glass"
          aria-labelledby={controlId}
          style={{ left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight }}
        >
          {options.map((option) => {
            const selected = option.value === selectedValue;
            return (
              <button
                key={option.value || "__empty"}
                id={`${listboxId}-${option.value}`}
                ref={(node) => {
                  if (node) optionRefs.current.set(option.value, node);
                  else optionRefs.current.delete(option.value);
                }}
                type="button"
                role="option"
                aria-selected={selected}
                className="scena-select-option"
                data-selected={selected}
                disabled={option.disabled}
                onClick={() => choose(option.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    moveFrom(option.value, event.key === "ArrowDown" ? 1 : -1);
                  } else if (event.key === "Home" || event.key === "End") {
                    event.preventDefault();
                    const enabled = options.filter((item) => !item.disabled);
                    const next = event.key === "Home" ? enabled[0] : enabled[enabled.length - 1];
                    if (next) optionRefs.current.get(next.value)?.focus();
                  } else if (event.key === "Escape" || event.key === "Tab") {
                    setOpen(false);
                    if (event.key === "Escape") {
                      event.preventDefault();
                      triggerRef.current?.focus();
                    }
                  } else if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    choose(option.value);
                  }
                }}
              >
                <span>{option.label}</span>
                <Check size={15} weight="bold" aria-hidden="true" />
              </button>
            );
          })}
        </div>,
        document.body,
      ) : null}
    </span>
  );
});
