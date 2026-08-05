import { Monitor } from "@phosphor-icons/react";

export function DisplaySelectionOption({ name, selected, onToggle }: {
  name: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="scena-session-display-option"
      data-selected={selected}
      aria-pressed={selected}
      onClick={onToggle}
    >
      <span className="scena-session-display-option__icon" aria-hidden="true">
        <Monitor size={20} weight={selected ? "fill" : "regular"} />
      </span>
      <span className="scena-session-display-option__name">{name}</span>
      <span className="scena-session-display-option__status">
        <span aria-hidden="true" />
        Ready
      </span>
    </button>
  );
}
