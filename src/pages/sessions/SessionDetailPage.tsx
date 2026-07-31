import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Broadcast, Check, Monitor, PencilSimple, Play, Plus, Star, Stop, Trash, Warning, X } from "@phosphor-icons/react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { canManage } from "../../auth/organization-context";
import * as Sessions from "../../domain/sessions";
import * as Control from "../../domain/sessionControl";
import * as Screens from "../../domain/screens";
import * as Layouts from "../../domain/layouts";
import * as Boards from "../../services/scena-api/boards";
import type { DisplayMode } from "../../shared/validation";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { StatusIndicator } from "../../components/ui/Badge";
import { Select } from "../../components/ui/Select";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Switch } from "../../components/ui/Checkbox";
import { Modal } from "../../components/ui/Modal";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { useToast } from "../../components/ui/Toast";

// duplicate/extend require a shared_layout_id; independent/single forbid one
// (enforced by setDisplayMode and the display_sessions_check constraint).
// Selecting duplicate/extend below opens a modal that collects the shared
// layout before the mode change is submitted.
const OFFERED_MODES: DisplayMode[] = ["independent", "single", "duplicate", "extend"];
const SHARED_LAYOUT_MODES: DisplayMode[] = ["duplicate", "extend"];

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const context = useManagerContext();
  const navigate = useNavigate();
  const toast = useToast();
  const manage = canManage(context.role);

  const [session, setSession] = useState<Sessions.SessionWithScreens | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [locationScreens, setLocationScreens] = useState<Screens.Screen[]>([]);
  const [locationLayouts, setLocationLayouts] = useState<Layouts.Layout[] | null>(null);
  const [workspaceBoards, setWorkspaceBoards] = useState<Boards.BoardSummary[] | null>(null);
  const [savingBoard, setSavingBoard] = useState(false);

  // Header rename state
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Lifecycle action state. `busy` holds the state currently being requested,
  // so each control can show its own spinner without a boolean per action.
  const [busy, setBusy] = useState<Control.SessionState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Control-room data. Every one of these is an authority the DATABASE owns;
  // none of it is recomputed here. See docs/implementation/SCENA_FULL_SYSTEM_PROGRAM.md §2.3.
  const [readiness, setReadiness] = useState<Control.ReadinessCheck[] | null>(null);
  const [events, setEvents] = useState<Control.SessionEvent[] | null>(null);
  const [health, setHealth] = useState<Map<string, Control.DisplayHealth>>(new Map());
  const [entitlements, setEntitlements] = useState<Control.EffectiveEntitlements | null>(null);
  const [usage, setUsage] = useState<Control.WorkspaceUsage | null>(null);

  // Add-display state
  const [addOpen, setAddOpen] = useState(false);
  const [availableScreens, setAvailableScreens] = useState<Screens.Screen[] | null>(null);
  const [addScreenId, setAddScreenId] = useState("");
  const [addLayoutId, setAddLayoutId] = useState("");
  const [adding, setAdding] = useState(false);

  // Shared-layout mode-change state (duplicate/extend require a layout)
  const [modeModalTarget, setModeModalTarget] = useState<DisplayMode | null>(null);
  const [modeModalLayoutId, setModeModalLayoutId] = useState("");
  const [changingMode, setChangingMode] = useState(false);

  function refresh() {
    if (!sessionId) return;
    setError(null);
    Sessions.getSession(context.workspace.id, sessionId)
      .then((result) => {
        if (!result) {
          setNotFound(true);
          return;
        }
        setSession(result);
        // Session-screen rows carry screen_id only — resolve display names
        // from the location's screen list (assigned screens may no longer be
        // 'ready', so listScreens rather than listAvailableScreens here).
        return Promise.all([
          Screens.listScreens(context.workspace.id, result.location_id).then(setLocationScreens),
          Layouts.listLayouts(context.workspace.id, result.location_id).then(setLocationLayouts),
          Boards.listBoards(context.workspace.id).then(({ boards }) => setWorkspaceBoards(boards)),
          // Control-room data. These are surfaced read-only and must never
          // block the page: a Session still renders if its timeline or health
          // is briefly unavailable.
          Control.getSessionReadiness(result.id).then(setReadiness).catch(() => setReadiness(null)),
          Control.listSessionEvents(context.workspace.id, result.id, 40).then(setEvents).catch(() => setEvents(null)),
          Control.getDisplayHealth(context.workspace.id).then(setHealth).catch(() => setHealth(new Map())),
          Control.getEffectiveEntitlements(context.workspace.id).then(setEntitlements).catch(() => setEntitlements(null)),
          Control.getWorkspaceUsage(context.workspace.id).then(setUsage).catch(() => setUsage(null)),
        ]);
      })
      .catch(setError);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, [context.workspace.id, sessionId]);

  function showError(err: unknown, fallback: string) {
    toast.show(err instanceof Error ? err.message : fallback, "danger");
  }

  async function saveName() {
    if (!session || !nameDraft.trim()) return;
    setSavingName(true);
    try {
      const updated = await Sessions.renameSession(context.workspace.id, session.id, nameDraft.trim());
      setSession({ ...session, ...updated });
      setRenaming(false);
    } catch (err) {
      showError(err, "Couldn't rename Session.");
    } finally {
      setSavingName(false);
    }
  }

  // Lifecycle is driven entirely by public.session_transition(). The database
  // owns the transition table, the readiness gate, the role check and the audit
  // event, so each control here is one call — never an orchestration.
  async function moveTo(...steps: Control.SessionState[]) {
    if (!session || steps.length === 0) return;
    const target = steps[steps.length - 1];
    setBusy(target);
    try {
      for (const step of steps) {
        await Control.transitionSession(context.workspace.id, session.id, step);
      }
      refresh();
    } catch (err) {
      showError(err, `Couldn't move this Session to ${Control.sessionStateLabel(target).toLowerCase()}.`);
      refresh();
    } finally {
      setBusy(null);
    }
  }

  // Starting walks draft -> ready -> starting -> active. Each hop is validated
  // separately; the readiness gate fires on entry to 'starting', so a Session
  // that is not ready fails there with the specific blocking reason.
  function start() {
    if (!session) return;
    switch (session.status as Control.SessionState) {
      case "paused":
        return void moveTo("active");
      case "ready":
        return void moveTo("starting", "active");
      case "draft":
      case "stopped":
      case "failed":
        return void moveTo("ready", "starting", "active");
      default:
        return;
    }
  }

  function stop() {
    void moveTo("stopping", "stopped");
  }

  async function deleteDraft() {
    if (!session) return;
    setDeleting(true);
    try {
      await Sessions.deleteDraftSession(context.workspace.id, session.id);
      toast.show("Draft Session deleted", "success");
      navigate("/app/sessions");
    } catch (err) {
      showError(err, "Couldn't delete Session.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  function changeMode(mode: DisplayMode) {
    if (!session || mode === session.display_mode) return;
    if (SHARED_LAYOUT_MODES.includes(mode)) {
      // duplicate/extend require a non-null shared layout — collect it in a
      // modal before submitting, instead of sending null and hitting the
      // display_sessions_check constraint.
      setModeModalLayoutId("");
      setModeModalTarget(mode);
      return;
    }
    applyModeChange(mode, null);
  }

  async function applyModeChange(mode: DisplayMode, sharedLayoutId: string | null) {
    if (!session) return;
    setChangingMode(true);
    try {
      const updated = await Sessions.setDisplayMode(context.workspace.id, session.id, mode, sharedLayoutId);
      setSession({ ...session, ...updated });
      setModeModalTarget(null);
    } catch (err) {
      showError(err, "Couldn't change display mode.");
    } finally {
      setChangingMode(false);
    }
  }

  async function changeBoard(boardId: string) {
    if (!session || session.status !== "draft") return;
    setSavingBoard(true);
    try {
      const updated = await Sessions.setSessionBoard(context.workspace.id, session.id, boardId || null);
      setSession({ ...session, ...updated });
      toast.show(boardId ? "Board assigned to Session" : "Board playback cleared", "success");
    } catch (err) {
      showError(err, "Couldn't assign Board to this Session.");
    } finally {
      setSavingBoard(false);
    }
  }

  function openAdd() {
    if (!session) return;
    setAddScreenId("");
    setAddLayoutId("");
    setAvailableScreens(null);
    setAddOpen(true);
    Screens.listAvailableScreens(context.workspace.id, session.location_id)
      .then(setAvailableScreens)
      .catch((err) => {
        setAddOpen(false);
        showError(err, "Couldn't load available Displays.");
      });
  }

  async function addScreen() {
    if (!session || !addScreenId) return;
    setAdding(true);
    try {
      await Sessions.addScreenToSession(context.workspace.id, session.location_id, session.id, {
        screen_id: addScreenId,
        layout_id: addLayoutId || null,
        is_primary: session.screens.length === 0,
        screen_order: session.screens.length,
      });
      setAddOpen(false);
      refresh();
    } catch (err) {
      showError(err, "Couldn't add Display.");
    } finally {
      setAdding(false);
    }
  }

  async function removeScreen(sessionScreenId: string) {
    try {
      await Sessions.removeScreenFromSession(context.workspace.id, sessionScreenId);
      refresh();
    } catch (err) {
      showError(err, "Couldn't remove Display.");
    }
  }

  async function makePrimary(sessionScreenId: string) {
    if (!session) return;
    try {
      await Sessions.setPrimaryScreen(context.workspace.id, session.id, sessionScreenId);
      refresh();
    } catch (err) {
      showError(err, "Couldn't set primary Display.");
    }
  }

  async function toggleEnabled(screen: Sessions.SessionScreen) {
    try {
      await Sessions.updateSessionScreen(context.workspace.id, screen.id, { is_enabled: !screen.is_enabled });
      refresh();
    } catch (err) {
      showError(err, "Couldn't update Display.");
    }
  }

  async function changeScreenLayout(sessionScreenId: string, layoutId: string) {
    try {
      await Sessions.updateSessionScreen(context.workspace.id, sessionScreenId, { layout_id: layoutId || null });
      refresh();
    } catch (err) {
      showError(err, "Couldn't update Display's layout.");
    }
  }

  if (notFound) {
    return (
      <div className="scena-page">
        <EmptyState
          icon={<Broadcast size={32} />}
          title="Session not found"
          description="This Session doesn't exist in this Workspace, or it was deleted."
          action={<Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => navigate("/app/sessions")}>Back to Sessions</Button>}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="scena-page">
        <ErrorBanner error={error} onRetry={refresh} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="scena-page">
        <Skeleton height={72} />
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <Skeleton height={64} />
          <Skeleton height={64} />
        </div>
      </div>
    );
  }

  const screenNames = new Map(locationScreens.map((screen) => [screen.id, screen.name]));
  const layoutNames = new Map((locationLayouts ?? []).map((layout) => [layout.id, layout.name]));
  const assignedIds = new Set(session.screens.map((screen) => screen.screen_id));
  const addableScreens = (availableScreens ?? []).filter((screen) => !assignedIds.has(screen.id));
  // Screen composition is meaningless once a Session stops or is archived —
  // the status trigger already released every screen — so composer edits stop
  // there.
  const composable = manage && session.status !== "stopped" && session.status !== "archived";
  // Readiness verdict comes from public.session_readiness(). `blocking` on each
  // row already separates "must fix" from "worth knowing", so nothing is
  // re-judged here.
  const blockingFailures = (readiness ?? []).filter((check) => !check.passed && check.blocking);
  const readinessWarnings = (readiness ?? []).filter((check) => !check.passed && !check.blocking);
  const canStart = Control.canTransition(session.status as Control.SessionState, "ready")
    || Control.canTransition(session.status as Control.SessionState, "starting")
    || session.status === "paused";
  // Mirrors resolveDisplayState.ts: duplicate/extend resolve every screen's
  // layout from the session's shared_layout_id, ignoring per-screen layout_id.
  const usesSharedLayout = session.display_mode === "duplicate" || session.display_mode === "extend";

  return (
    <div className="scena-page">
      <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigate("/app/sessions")}>
        Back to Sessions
      </Button>

      {renaming ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <Input
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void saveName();
              if (event.key === "Escape") setRenaming(false);
            }}
            style={{ maxWidth: 320 }}
            autoFocus
          />
          <Button variant="primary" size="sm" icon={<Check size={16} />} loading={savingName} disabled={!nameDraft.trim()} onClick={saveName}>
            Save
          </Button>
          <Button variant="ghost" size="sm" icon={<X size={16} />} onClick={() => setRenaming(false)} disabled={savingName}>
            Cancel
          </Button>
        </div>
      ) : (
        <PageHeader
          title={session.name}
          description={`${Control.sessionStateLabel(session.status)} · created ${new Date(session.created_at).toLocaleString()}`}
          actions={
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <StatusIndicator status={session.status} />
              {manage && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<PencilSimple size={16} />}
                  onClick={() => {
                    setNameDraft(session.name);
                    setRenaming(true);
                  }}
                >
                  Rename
                </Button>
              )}
              {/* Controls mirror private.session_transition_allowed(). The
                  database still has the final say, so a control that is shown
                  can still be refused — with a specific reason. */}
              {manage && canStart && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Play size={16} />}
                  loading={busy === "active"}
                  disabled={busy !== null || (blockingFailures.length > 0 && session.status !== "paused")}
                  onClick={start}
                >
                  {session.status === "paused" ? "Resume" : "Start"}
                </Button>
              )}
              {manage && Control.canTransition(session.status as Control.SessionState, "paused") && (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={busy === "paused"}
                  disabled={busy !== null}
                  onClick={() => void moveTo("paused")}
                >
                  Pause
                </Button>
              )}
              {manage && Control.canTransition(session.status as Control.SessionState, "stopping") && (
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Stop size={16} />}
                  loading={busy === "stopped"}
                  disabled={busy !== null}
                  onClick={stop}
                >
                  Stop
                </Button>
              )}
              {manage && Control.canTransition(session.status as Control.SessionState, "archived") && session.status !== "draft" && (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={busy === "archived"}
                  disabled={busy !== null}
                  onClick={() => void moveTo("archived")}
                >
                  Archive
                </Button>
              )}
              {manage && session.status === "draft" && (
                <Button variant="danger" size="sm" icon={<Trash size={16} />} onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              )}
            </div>
          }
        />
      )}

      {/* Readiness. Rendered verbatim from public.session_readiness() — the UI
          does not decide what "ready" means, and must never filter a failing
          check out of this list. */}
      {readiness && (
        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: "var(--scena-text-xs)", textTransform: "uppercase", color: "var(--scena-text-muted)" }}>
              Readiness
            </div>
            <div style={{ fontSize: "var(--scena-text-sm)", color: "var(--scena-text-muted)" }}>
              {blockingFailures.length === 0
                ? `All ${readiness.length} checks passed`
                : `${blockingFailures.length} of ${readiness.length} checks must be fixed before starting`}
            </div>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {readiness.map((check) => (
              <li
                key={check.check_key}
                style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "var(--scena-text-sm)" }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    marginTop: 2,
                    color: check.passed
                      ? "var(--scena-success)"
                      : check.blocking
                        ? "var(--scena-danger)"
                        : "var(--scena-warning)",
                  }}
                >
                  {check.passed ? <Check size={16} /> : <Warning size={16} />}
                </span>
                <span style={{ color: check.passed ? "var(--scena-text-muted)" : "var(--scena-text)" }}>
                  {check.message}
                  <span className="scena-visually-hidden">
                    {check.passed ? " — passed" : check.blocking ? " — must be fixed" : " — warning"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {readinessWarnings.length > 0 && blockingFailures.length === 0 && (
            <div style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)" }}>
              This Session can start. Warnings above will resolve on their own once every Display reports in.
            </div>
          )}
        </Card>
      )}

      {/* Plan context. Numbers come from workspace_effective_entitlements and
          workspace_usage_current, which are the same values the database
          enforces — so this panel cannot disagree with a rejected action. */}
      {entitlements && usage && (
        <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: "var(--scena-text-xs)", textTransform: "uppercase", color: "var(--scena-text-muted)" }}>
            Plan usage
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: "var(--scena-text-sm)" }}>
            <span>
              Displays <strong>{usage.displays_used ?? 0}</strong> of {entitlements.max_displays}
            </span>
            <span>
              Boards <strong>{usage.boards_used ?? 0}</strong> of {entitlements.max_boards}
            </span>
            <span>
              Live Sessions <strong>{usage.active_sessions_used ?? 0}</strong> of {entitlements.max_concurrent_sessions}
            </span>
            <span>
              Displays in this Session <strong>{session.screens.length}</strong> of {entitlements.max_displays_per_session}
            </span>
          </div>
          {entitlements.has_override && (
            <div style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)" }}>
              An approved limit override is active on this Workspace.
            </div>
          )}
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, alignItems: "start" }}>
        <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: "var(--scena-text-xs)", textTransform: "uppercase", color: "var(--scena-text-muted)" }}>Display mode</div>
          <Field label="Mode" htmlFor="session-display-mode" hint="Duplicate and extend broadcast one shared Layout to every Display; independent and single assign Layouts per Display.">
            <Select
              id="session-display-mode"
              value={session.display_mode}
              onChange={(event) => changeMode(event.target.value as DisplayMode)}
              disabled={!composable || changingMode}
              options={[
                // Keep the current mode visible even if it isn't offerable
                // (e.g. a duplicate/extend session created elsewhere).
                ...(OFFERED_MODES.includes(session.display_mode as DisplayMode) ? [] : [{ value: session.display_mode, label: session.display_mode }]),
                ...OFFERED_MODES.map((mode) => ({ value: mode, label: mode })),
              ]}
            />
          </Field>
          <div style={{ fontSize: "var(--scena-text-sm)", color: "var(--scena-text-secondary)", display: "grid", gap: 6 }}>
            <span>Started: {session.started_at ? new Date(session.started_at).toLocaleString() : "—"}</span>
            <span>Stopped: {session.stopped_at ? new Date(session.stopped_at).toLocaleString() : "—"}</span>
          </div>
        </Card>

        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: "var(--scena-text-xs)", textTransform: "uppercase", color: "var(--scena-text-muted)" }}>Board playback</div>
          <Field
            label="Board"
            htmlFor="session-board"
            hint="A Board renders live scene elements on every assigned Display. Clear it to keep legacy Layout playback."
          >
            {workspaceBoards === null ? <Skeleton height={40} /> : (
              <Select
                id="session-board"
                value={session.board_id ?? ""}
                onChange={(event) => void changeBoard(event.target.value)}
                disabled={!composable || savingBoard}
                options={[
                  { value: "", label: "Legacy Layout playback" },
                  ...workspaceBoards.filter((board) => board.status === "active").map((board) => ({ value: board.id, label: board.name })),
                ]}
              />
            )}
          </Field>
          {session.board_id && workspaceBoards && !workspaceBoards.some((board) => board.id === session.board_id) && (
            <div style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-warning)" }}>The assigned Board is no longer available in this Workspace.</div>
          )}
          {session.board_id && workspaceBoards?.some((board) => board.id === session.board_id) && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-text-secondary)" }}>
                {session.status === "active" ? "Edit the Board and save to push the next update to every assigned Display." : "Edit this Board before or during the Session."}
              </span>
              <Link to={`/app/boards/${session.board_id}?liveSession=${session.id}`} className="scena-btn scena-btn--secondary scena-btn--sm">
                <PencilSimple size={16} /> Edit live Board
              </Link>
            </div>
          )}
        </Card>

        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: "var(--scena-text-xs)", textTransform: "uppercase", color: "var(--scena-text-muted)" }}>
              Displays ({session.screens.length})
            </div>
            {composable && (
              <Button variant="secondary" size="sm" icon={<Plus size={16} />} onClick={openAdd}>
                Add display
              </Button>
            )}
          </div>

          {locationLayouts !== null && locationLayouts.length === 0 && (
            <div style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-warning)" }}>
              This location has no Layouts yet, so every Display here will stay on standby. <Link to="/app/layouts">Create a Layout</Link> first.
            </div>
          )}

          {session.screens.length === 0 ? (
            <EmptyState
              icon={<Monitor size={32} />}
              title="No Displays assigned"
              description={
                session.status === "stopped"
                  ? "Stopping a Session releases its Displays."
                  : "Add a Display so this Session has somewhere to play."
              }
              action={composable ? <Button variant="secondary" size="sm" icon={<Plus size={16} />} onClick={openAdd}>Add display</Button> : undefined}
            />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {session.screens.map((screen) => (
                <div
                  key={screen.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    padding: "10px 12px",
                    background: "var(--scena-surface-2)",
                    borderRadius: "var(--scena-radius-md)",
                  }}
                >
                  <Monitor size={20} style={{ color: "var(--scena-text-muted)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      {screenNames.get(screen.screen_id) ?? "Unknown display"}
                      {screen.is_primary && <Star size={14} weight="fill" style={{ color: "var(--scena-text-muted)" }} aria-label="Primary" />}
                    </div>
                    <div style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)" }}>
                      Order {screen.screen_order}
                      {screen.rotation_degrees ? ` · ${screen.rotation_degrees}°` : ""}
                      {/* Live health from display_health. "Not reported yet"
                          is deliberate: an absent row means the Display has
                          never heartbeated, which is different from offline. */}
                      {(() => {
                        const dh = health.get(screen.screen_id);
                        if (!dh) return " · Not reported yet";
                        const seen = dh.last_heartbeat_at
                          ? new Date(dh.last_heartbeat_at).toLocaleTimeString()
                          : "never";
                        return ` · ${dh.connection_state === "online" ? "Online" : "Offline"} (${dh.health_state}), last seen ${seen}`;
                      })()}
                    </div>
                    {health.get(screen.screen_id)?.last_error_message_safe && (
                      <div style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-danger)" }}>
                        {health.get(screen.screen_id)?.last_error_message_safe}
                      </div>
                    )}
                  </div>
                  {usesSharedLayout ? (
                    <span style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)" }}>
                      Shared layout: {session.shared_layout_id ? (layoutNames.get(session.shared_layout_id) ?? "Unknown") : "Not set"}
                    </span>
                  ) : composable ? (
                    locationLayouts === null ? (
                      <Skeleton height={36} />
                    ) : locationLayouts.length === 0 ? (
                      <span style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-warning)" }}>
                        No Layouts yet — <Link to="/app/layouts">create one</Link>
                      </span>
                    ) : (
                      <div style={{ minWidth: 180 }}>
                        <Field label="Layout" htmlFor={`session-screen-layout-${screen.id}`}>
                          <Select
                            id={`session-screen-layout-${screen.id}`}
                            value={screen.layout_id ?? ""}
                            onChange={(event) => changeScreenLayout(screen.id, event.target.value)}
                            options={[
                              { value: "", label: "No layout (standby)" },
                              ...locationLayouts.map((layout) => ({ value: layout.id, label: layout.name })),
                            ]}
                          />
                        </Field>
                      </div>
                    )
                  ) : (
                    <span style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)" }}>
                      Layout: {screen.layout_id ? (layoutNames.get(screen.layout_id) ?? "Unknown") : "Not set"}
                    </span>
                  )}
                  {composable ? (
                    <>
                      <Switch checked={screen.is_enabled} onChange={() => toggleEnabled(screen)} label={screen.is_enabled ? "Enabled" : "Disabled"} />
                      {!screen.is_primary && (
                        <Button variant="ghost" size="sm" icon={<Star size={16} />} onClick={() => makePrimary(screen.id)}>
                          Set primary
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" icon={<Trash size={16} />} onClick={() => removeScreen(screen.id)}>
                        Remove
                      </Button>
                    </>
                  ) : (
                    <span style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)" }}>
                      {screen.is_enabled ? "Enabled" : "Disabled"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Activity. Read straight from session_events, which is append-only and
          has no write policy — so this timeline cannot have been edited. */}
      <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: "var(--scena-text-xs)", textTransform: "uppercase", color: "var(--scena-text-muted)" }}>
          Activity
        </div>
        {events === null ? (
          <Skeleton height={80} />
        ) : events.length === 0 ? (
          <div style={{ fontSize: "var(--scena-text-sm)", color: "var(--scena-text-muted)" }}>
            Nothing has happened on this Session yet.
          </div>
        ) : (
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {events.map((event) => (
              <li
                key={event.id}
                style={{ display: "flex", gap: 12, alignItems: "baseline", fontSize: "var(--scena-text-sm)" }}
              >
                <time
                  dateTime={event.occurred_at}
                  style={{ flexShrink: 0, color: "var(--scena-text-muted)", fontSize: "var(--scena-text-xs)", minWidth: 130 }}
                >
                  {new Date(event.occurred_at).toLocaleString()}
                </time>
                <span>
                  {Control.sessionEventLabel(event.event_type)}
                  {event.actor_type !== "user" && (
                    <span style={{ color: "var(--scena-text-muted)" }}> · {event.actor_type}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Modal
        open={addOpen}
        onClose={() => !adding && setAddOpen(false)}
        title="Add a Display"
        description="Only paired, ready Displays at this Session's location can be added."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={adding}>
              Cancel
            </Button>
            <Button variant="primary" onClick={addScreen} loading={adding} disabled={!addScreenId}>
              Add display
            </Button>
          </>
        }
      >
        {!availableScreens ? (
          <Skeleton height={40} />
        ) : addableScreens.length === 0 ? (
          <EmptyState icon={<Monitor size={32} />} title="No Displays available" description="Every ready Display at this location is already assigned, or none are paired yet." />
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            <Field label="Display">
              <Select
                value={addScreenId}
                onChange={(event) => setAddScreenId(event.target.value)}
                options={[{ value: "", label: "Select a display" }, ...addableScreens.map((screen) => ({ value: screen.id, label: screen.name }))]}
              />
            </Field>
            {usesSharedLayout ? (
              <div style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)" }}>
                This Session is in {session.display_mode} mode, so this Display will use the Session's shared Layout instead of its own.
              </div>
            ) : locationLayouts === null ? (
              <Skeleton height={40} />
            ) : locationLayouts.length === 0 ? (
              <div style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-warning)" }}>
                This location has no Layouts yet, so this Display will stay on standby until you <Link to="/app/layouts">create a Layout</Link> and assign it.
              </div>
            ) : (
              <Field label="Layout" htmlFor="add-display-layout" hint="Optional — you can assign a Layout later.">
                <Select
                  id="add-display-layout"
                  value={addLayoutId}
                  onChange={(event) => setAddLayoutId(event.target.value)}
                  options={[
                    { value: "", label: "No layout (standby)" },
                    ...locationLayouts.map((layout) => ({ value: layout.id, label: layout.name })),
                  ]}
                />
              </Field>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={modeModalTarget !== null}
        onClose={() => !changingMode && setModeModalTarget(null)}
        title={`Switch to ${modeModalTarget ?? ""} mode`}
        description="This mode broadcasts one shared Layout to every Display in the Session — pick which Layout to use."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModeModalTarget(null)} disabled={changingMode}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={changingMode}
              disabled={!modeModalLayoutId}
              onClick={() => modeModalTarget && applyModeChange(modeModalTarget, modeModalLayoutId)}
            >
              Switch mode
            </Button>
          </>
        }
      >
        {locationLayouts === null ? (
          <Skeleton height={40} />
        ) : locationLayouts.length === 0 ? (
          <EmptyState
            icon={<Broadcast size={32} />}
            title="No Layouts yet"
            description="This location has no Layouts to share. Create one first, then switch modes."
            action={
              <Link to="/app/layouts">
                <Button variant="secondary" size="sm">Go to Layouts</Button>
              </Link>
            }
          />
        ) : (
          <Field label="Shared layout" htmlFor="mode-shared-layout">
            <Select
              id="mode-shared-layout"
              value={modeModalLayoutId}
              onChange={(event) => setModeModalLayoutId(event.target.value)}
              options={[{ value: "", label: "Select a layout" }, ...locationLayouts.map((layout) => ({ value: layout.id, label: layout.name }))]}
            />
          </Field>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this draft Session?"
        description="Only draft Sessions can be deleted. This can't be undone."
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={deleteDraft}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
