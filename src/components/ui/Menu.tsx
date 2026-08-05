import { cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";

export interface MenuItemDef {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export interface DropdownMenuProps {
  trigger: ReactNode;
  items: MenuItemDef[];
  align?: "left" | "right";
}

/** Click-outside + Escape to close; returns focus to the trigger on close. */
export function DropdownMenu({ trigger, items, align = "right" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node) && !popoverRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    function place() {
      const triggerRect = triggerRef.current!.getBoundingClientRect();
      const popoverWidth = popoverRef.current?.offsetWidth ?? 216;
      const popoverHeight = popoverRef.current?.offsetHeight ?? items.length * 40 + 16;
      const preferredLeft = align === "left" ? triggerRect.left : triggerRect.right - popoverWidth;
      const left = Math.max(8, Math.min(window.innerWidth - popoverWidth - 8, preferredLeft));
      const below = triggerRect.bottom + 8;
      const top = below + popoverHeight <= window.innerHeight - 8 ? below : Math.max(8, triggerRect.top - popoverHeight - 8);
      setPosition({ top, left });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [align, items.length, open]);

  // The trigger is cloned in place (instead of wrapped in a focusable span) so
  // that focus, click, and ARIA state attach directly to whatever focusable
  // element the caller passed — wrapping would either double up focus stops
  // or, for non-focusable triggers, remove the trigger from the tab order.
  const triggerNode = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<Record<string, unknown>>, {
        ref: triggerRef,
        onClick: (event: ReactMouseEvent) => {
          (trigger.props as { onClick?: (e: ReactMouseEvent) => void }).onClick?.(event);
          setOpen((value) => !value);
        },
        "aria-haspopup": "menu",
        "aria-expanded": open,
      })
    : trigger;

  return (
    <div className="scena-menu-wrap" ref={wrapRef}>
      {triggerNode}
      {open && createPortal(
        <div ref={popoverRef} className={cx("scena-menu-popover", align === "left" && "scena-menu-popover--left")} style={{ top: position.top, left: position.left }}>
          <div className="scena-menu scena-glass-medium" role="menu">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={cx("scena-menu__item", item.danger && "scena-menu__item--danger")}
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                }}
              >
                {item.icon}
                {item.label}
                {item.shortcut && <span className="scena-menu__shortcut">{item.shortcut}</span>}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export function MenuSeparator() {
  return <div className="scena-menu__separator" />;
}
