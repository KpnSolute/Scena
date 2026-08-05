import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Broadcast, Monitor, Plus, DotsThreeVertical, Trash, PencilSimple } from "@phosphor-icons/react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { canManage } from "../../auth/organization-context";
import * as Screens from "../../domain/screens";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button, IconButton } from "../../components/ui/Button";
import { StatusIndicator } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { Skeleton } from "../../components/ui/Skeleton";
import { DropdownMenu } from "../../components/ui/Menu";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";

export function ScreensPage() {
  const context = useManagerContext();
  const navigate = useNavigate();
  const toast = useToast();
  const manage = canManage(context.role);
  const [screens, setScreens] = useState<Screens.Screen[] | null>(null);
  const [sessionLinks, setSessionLinks] = useState<Map<string, Screens.ScreenSessionLink>>(new Map());
  const [error, setError] = useState<unknown>(null);
  const [revokeTarget, setRevokeTarget] = useState<Screens.Screen | null>(null);
  const [revoking, setRevoking] = useState(false);

  function load() {
    setError(null);
    Promise.all([Screens.listScreens(context.workspace.id), Screens.listScreenSessionLinks(context.workspace.id)])
      .then(([nextScreens, links]) => { setScreens(nextScreens); setSessionLinks(links); })
      .catch(setError);
  }
  useEffect(load, [context.workspace.id]);

  async function handleRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await Screens.revokeScreen(context.workspace.id, revokeTarget.id);
      toast.show("Display revoked", "success");
      load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't revoke Display.", "danger");
    } finally {
      setRevoking(false);
      setRevokeTarget(null);
    }
  }

  async function handleRename(screen: Screens.Screen) {
    const name = window.prompt("Display name", screen.name ?? "");
    if (!name || name === screen.name) return;
    try {
      await Screens.renameScreen(context.workspace.id, screen.id, name);
      load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't rename Display.", "danger");
    }
  }

  return (
    <div className="scena-page">
      <PageHeader
        title="Displays"
        description="Physical screens paired to this Workspace."
        actions={manage ? <Button variant="primary" icon={<Plus size={18} />} onClick={() => navigate("/app/screens/pair")}>Pair a Display</Button> : undefined}
      />

      {error ? (
        <ErrorBanner error={error} onRetry={load} />
      ) : !screens ? (
        <div style={{ display: "grid", gap: 12 }}>
          <Skeleton height={56} /><Skeleton height={56} />
        </div>
      ) : screens.length === 0 ? (
        <EmptyState
          icon={<Monitor size={32} />}
          title="No Displays yet"
          description="Pair a physical screen with a six-digit code to get started."
          action={manage && <Button variant="primary" size="sm" onClick={() => navigate("/app/screens/pair")}>Pair a Display</Button>}
        />
      ) : (
        <div className="scena-table-wrap">
          <table className="scena-table">
            <caption className="scena-visually-hidden">Displays</caption>
            <thead><tr><th scope="col">Name</th><th scope="col">Status</th><th scope="col">Last seen</th>{manage && <th scope="col" />}</tr></thead>
            <tbody>
              {screens.map((screen) => (
                <tr key={screen.id}>
                  <td><Link to={`/app/screens/${screen.id}`} style={{ fontWeight: 600 }}>{screen.name}</Link>{sessionLinks.get(screen.id) && <small className="scena-display-session-link">Session: {sessionLinks.get(screen.id)!.session_name}</small>}</td>
                  <td><StatusIndicator status={isOnline(screen) ? "online" : screen.status} /></td>
                  <td>{screen.last_seen_at ? new Date(screen.last_seen_at).toLocaleString() : "Never"}</td>
                  {manage && (
                    <td style={{ width: 40 }}>
                      <DropdownMenu
                        trigger={<IconButton icon={<DotsThreeVertical size={18} />} label="Display actions" size="sm" />}
                        items={[
                          ...(sessionLinks.get(screen.id) ? [{ key: "control-room", icon: <Broadcast size={16} />, label: "Open control room", onSelect: () => navigate(`/app/sessions/${sessionLinks.get(screen.id)!.session_id}`) }] : []),
                          { key: "rename", icon: <PencilSimple size={16} />, label: "Rename", onSelect: () => handleRename(screen) },
                          { key: "revoke", icon: <Trash size={16} />, label: "Revoke", danger: true, disabled: screen.status === "revoked", onSelect: () => setRevokeTarget(screen) },
                        ]}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!revokeTarget}
        title={`Revoke "${revokeTarget?.name}"?`}
        description="A revoked Display stops receiving content and can't be re-paired without a new pairing code."
        confirmLabel="Revoke"
        danger
        loading={revoking}
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
}

function isOnline(screen: Screens.Screen): boolean {
  if (screen.status !== "ready" || !screen.last_seen_at) return false;
  return Date.now() - new Date(screen.last_seen_at).getTime() < 5 * 60 * 1000;
}
