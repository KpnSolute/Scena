import { Fragment, cloneElement, isValidElement, useId } from "react";
import type { ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { cx } from "./cx";

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

// Minimal shape of the props we may inject onto the child control. `children`
// is typed as `ReactNode`, so `isValidElement` narrows it to `ReactElement<any>`
// and this cast just documents which props we rely on being controllable.
interface ControllableProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

export function Field({ label, hint, error, htmlFor, children, className }: FieldProps) {
  const generatedId = useId();
  const fieldId = htmlFor ?? generatedId;

  // Fragments, arrays, strings, numbers, etc. aren't a single controllable
  // element — render them untouched rather than trying to clone into them.
  // (Fragment is technically a valid element type, so it's excluded explicitly.)
  // Kept as its own variable (rather than a boolean flag) so TypeScript's
  // control-flow narrowing carries the ReactElement type to every use below.
  const controlElement = isValidElement(children) && children.type !== Fragment ? children : null;
  const childId = controlElement ? (controlElement.props as ControllableProps).id : undefined;
  // An explicit id on the child always wins; otherwise the control gets the
  // caller-provided htmlFor (or the generated id) so the label stays in sync.
  const controlId = childId ?? fieldId;

  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  // Only one of hint/error is ever rendered below (error takes precedence),
  // so aria-describedby only ever points at an id that actually exists in the DOM.
  const describedBy = error ? errorId : hint ? hintId : undefined;

  let renderedChildren = children;
  if (controlElement) {
    const injectedProps: ControllableProps = {};
    if (!childId) injectedProps.id = controlId;
    if (describedBy) injectedProps["aria-describedby"] = describedBy;
    if (error) injectedProps["aria-invalid"] = true;
    if (Object.keys(injectedProps).length > 0) {
      renderedChildren = cloneElement(controlElement, injectedProps);
    }
  }

  return (
    <div className={cx("scena-field", className)}>
      {label && (
        <label className="scena-field__label" htmlFor={controlId}>
          {label}
        </label>
      )}
      {renderedChildren}
      {error ? (
        <span id={errorId} className="scena-field__error" role="alert">
          <WarningCircle size={14} weight="fill" />
          {error}
        </span>
      ) : hint ? (
        <span id={hintId} className="scena-field__hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
