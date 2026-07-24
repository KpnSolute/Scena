import { useState } from "react";
import { CaretUpDown, Check, Buildings, User, WarningCircle } from "@phosphor-icons/react";
import { DropdownMenu } from "../ui/Menu";
import { switchAccountWorkspace } from "../../auth/organization-context";
import type { ManagerContext } from "../../auth/organization-context";

export function WorkspaceSwitcher({ context }: { context: ManagerContext }) {
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");

  async function handleSelect(workspaceId: string) {
    if (workspaceId === context.workspace.id || switching) return;
    setSwitching(true);
    setError("");
    try {
      await switchAccountWorkspace(workspaceId);
      // Full reload: ManagerGuard re-resolves the whole account context from
      // scratch for the newly selected Workspace rather than patching state.
      window.location.assign("/app/home");
    } catch (err) {
      setSwitching(false);
      setError(err instanceof Error ? err.message : "Couldn't switch Workspace.");
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <DropdownMenu
        align="left"
        trigger={
          <button type="button" className="scena-workspace-trigger" aria-label="Switch workspace">
            {context.workspace.type === "team" ? <Buildings size={18} /> : <User size={18} />}
            <span className="scena-workspace-trigger__name">{context.workspace.name}</span>
            <CaretUpDown size={14} />
          </button>
        }
      items={context.workspaces.map((workspace) => {
        const isCurrent = workspace.id === context.workspace.id;
        return {
          key: workspace.id,
          icon: workspace.type === "team" ? <Buildings size={16} /> : <User size={16} />,
          label: (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 8 }}>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <span>{workspace.name}</span>
                <span style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)" }}>
                  {workspace.type === "team" ? "Team Workspace" : "Personal Workspace"}
                </span>
              </span>
              {isCurrent && <Check size={16} style={{ color: "var(--scena-violet)" }} />}
            </span>
          ),
          onSelect: () => handleSelect(workspace.id),
        };
      })}
      />
      {error && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--scena-text-xs)", color: "var(--scena-danger)" }}>
          <WarningCircle size={14} weight="fill" />
          {error}
        </span>
      )}
    </div>
  );
}
