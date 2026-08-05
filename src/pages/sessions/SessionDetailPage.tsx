import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Broadcast, Check, ClockCounterClockwise, Monitor, PencilSimple, Play, Plus, Star, Stop, Trash, Warning, X } from "@phosphor-icons/react";
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
import { DisplayTopology } from "../../components/sessions/DisplayTopology";
import type { DisplayViewport } from "../../domain/displayTopology";

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

  // The control room stays live while it is open. This is deliberately a
  // bounded read-only poll of the one-row-per-Display health table; the kiosk
  // continues to own playback and never receives Manager credentials.
  useEffect(() => {
    let active = true;
    const interval = window.setInterval(() => {
      Control.getDisplayHealth(context.workspace.id)
        .then((next) => { if (active) setHealth(next); })
        .catch(() => {});
    }, 4000);
    return () => { active = false; window.clearInterval(interval); };
  }, [context.workspace.id, sessionId]);

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
    void moveTo(...Control.startTransitionPath(session.status as Control.SessionState));
  }

  function stop() {
    if (!session) return;
    void moveTo(...Control.stopTransitionPath(session.status as Control.SessionState));
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

  async function changeScreenViewport(sessionScreenId: string, viewport: DisplayViewport) {
    try {
      await Sessions.updateSessionScreen(context.workspace.id, sessionScreenId, { viewport });
      refresh();
    } catch (err) {
      showError(err, "Couldn't move this Display.");
    }
  }

  async function changeScreenBoard(sessionScreenId: string, boardId: string | null) {
    if (!session) return;
    try {
      // Keep a Session-level Board as the safe fallback required by the
      // current lifecycle/readiness contract. Independent outputs may then
      // override it with their own Board.
      if (boardId && !session.board_id && session.status === "draft") {
        await Sessions.setSessionBoard(context.workspace.id, session.id, boardId);
      }
      await Sessions.updateSessionScreen(context.workspace.id, sessionScreenId, { board_id: boardId });
      refresh();
    } catch (err) {
      showError(err, "Couldn't route this Board to the Display.");
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
  const passedChecks = (readiness ?? []).filter((check) => check.passed);
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

      <section className="scena-session-summary" aria-label="Session overview">
        <Card className={`scena-session-state scena-session-state--${session.status}`}>
          <div className="scena-session-state__icon"><Broadcast size={24} weight="duotone" /></div>
          <div>
            <span className="scena-session-eyebrow">Operational state</span>
            <strong>{Control.sessionStateLabel(session.status)}</strong>
            <p>{session.status === "active" ? "Content is live on assigned Displays." : session.status === "stopped" ? "Playback ended and Display assignments were released." : "Session configuration is retained for the next action."}</p>
          </div>
          <div className="scena-session-state__meta">
            <span>{session.display_mode} mode</span>
            <span>{session.started_at ? `Started ${new Date(session.started_at).toLocaleString()}` : "Not started yet"}</span>
          </div>
        </Card>

        {entitlements && usage && (
          <div className="scena-session-metrics">
            <UsageMetric icon={<Monitor size={18} />} label="Displays" value={usage.displays_used ?? 0} limit={entitlements.max_displays} />
            <UsageMetric icon={<Broadcast size={18} />} label="Boards" value={usage.boards_used ?? 0} limit={entitlements.max_boards} />
            <UsageMetric icon={<Play size={18} />} label="Live Sessions" value={usage.active_sessions_used ?? 0} limit={entitlements.max_concurrent_sessions} />
            <UsageMetric icon={<Monitor size={18} />} label="In this Session" value={session.screens.length} limit={entitlements.max_displays_per_session} />
          </div>
        )}
      </section>

      <div className="scena-session-workspace">
        <div className="scena-session-workspace__main">
          <div className="scena-session-config-grid">
        <Card className="scena-session-panel scena-session-panel--mode">
          <div className="scena-session-panel__header">
            <div className="scena-session-panel__icon"><Monitor size={20} weight="duotone" /></div>
            <div><span className="scena-session-eyebrow">Routing</span><h2>Display mode</h2></div>
          </div>
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
          <div className="scena-session-panel__facts">
            <span>Started: {session.started_at ? new Date(session.started_at).toLocaleString() : "—"}</span>
            <span>Stopped: {session.stopped_at ? new Date(session.stopped_at).toLocaleString() : "—"}</span>
          </div>
        </Card>

        <Card className="scena-session-panel scena-session-panel--board">
          <div className="scena-session-panel__header">
            <div className="scena-session-panel__icon"><Broadcast size={20} weight="duotone" /></div>
            <div><span className="scena-session-eyebrow">Content</span><h2>Board playback</h2></div>
          </div>
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
          </div>

        {workspaceBoards !== null && (
          <DisplayTopology
            screens={session.screens}
            screenNames={screenNames}
            boards={workspaceBoards}
            fallbackBoardId={session.board_id}
            disabled={!composable}
            onViewport={(screenId, viewport) => void changeScreenViewport(screenId, viewport)}
            onBoard={(screenId, boardId) => void changeScreenBoard(screenId, boardId)}
          />
        )}

        <Card className="scena-session-panel scena-session-panel--displays">
          <div className="scena-session-panel__topline">
            <div className="scena-session-panel__header">
              <div className="scena-session-panel__icon"><Monitor size={20} weight="duotone" /></div>
              <div><span className="scena-session-eyebrow">Destinations</span><h2>Displays <small>{session.screens.length}</small></h2></div>
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
            <div className="scena-session-output-grid">
              {session.screens.map((screen) => {
                const displayHealth = health.get(screen.screen_id);
                const runtime = Control.parseDisplayRuntimeStats(displayHealth?.runtime_stats);
                const connection = displayHealth?.connection_state ?? "unknown";
                const resolution = displayHealth?.resolution_width && displayHealth?.resolution_height
                  ? `${displayHealth.resolution_width}×${displayHealth.resolution_height}${runtime.devicePixelRatio ? ` @ ${runtime.devicePixelRatio}x` : ""}`
                  : "Not reported";
                return (
                <div
                  key={screen.id}
                  className={`scena-session-output scena-session-output--${connection}`}
                >
                  <header className="scena-session-output__header">
                    <div className="scena-session-output__identity">
                      <div className="scena-session-display__icon"><Monitor size={20} weight="duotone" /></div>
                      <div>
                        <span className="scena-session-eyebrow">Output {screen.screen_order}</span>
                        <div className="scena-session-display__name">
                          {screenNames.get(screen.screen_id) ?? "Unknown display"}
                          {screen.is_primary && <Star size={14} weight="fill" aria-label="Primary" />}
                        </div>
                      </div>
                    </div>
                    <div className={`scena-session-health scena-session-health--${connection}`}>
                      <span className="scena-session-health__dot" />
                      <div>
                        <strong>{displayHealth ? (connection === "online" ? "LIVE" : "OFFLINE") : "WAITING"}</strong>
                        <small>{displayHealth?.last_heartbeat_at ? new Date(displayHealth.last_heartbeat_at).toLocaleTimeString() : "No heartbeat"}</small>
                      </div>
                    </div>
                  </header>

                  <div className="scena-session-output__meters">
                    <RuntimeMeter label="Render" value={runtime.fps === null ? "—" : `${Math.round(runtime.fps)} FPS`} percentage={runtime.fps === null ? 0 : Math.min(100, runtime.fps / 60 * 100)} tone={runtime.fps !== null && runtime.fps < 24 ? "danger" : "success"} />
                    <RuntimeMeter label="Poll" value={runtime.pollLatencyMs === null ? "—" : `${Math.round(runtime.pollLatencyMs)} ms`} percentage={runtime.pollLatencyMs === null ? 0 : Math.min(100, runtime.pollLatencyMs / 20)} tone={runtime.pollLatencyMs !== null && runtime.pollLatencyMs > 2000 ? "danger" : "brand"} />
                  </div>

                  <div className="scena-session-output__telemetry">
                    <RuntimeDatum label="Player" value={runtime.playerStatus ?? displayHealth?.health_state ?? "Not reported"} />
                    <RuntimeDatum label="Sync" value={displayHealth?.sync_state ?? "Not reported"} />
                    <RuntimeDatum label="Cache" value={runtime.cacheSource ?? displayHealth?.cached_content_state ?? "Not reported"} />
                    <RuntimeDatum label="Errors" value={String(runtime.pollErrorCount)} alert={runtime.pollErrorCount > 0} />
                    <RuntimeDatum label="Uptime" value={formatRuntimeDuration(runtime.uptimeSeconds)} />
                    <RuntimeDatum label="Resolution" value={resolution} />
                    <RuntimeDatum label="Hardware" value={`${runtime.cpuCores ?? "—"} cores · ${runtime.deviceMemoryGb === null ? "—" : `≥${runtime.deviceMemoryGb} GB`}`} />
                    <RuntimeDatum label="Network" value={runtime.networkEffectiveType ? `${runtime.networkEffectiveType}${runtime.networkDownlinkMbps === null ? "" : ` · ${runtime.networkDownlinkMbps} Mbps`}` : displayHealth?.network_quality ?? "Not reported"} />
                  </div>

                  <div className="scena-session-output__content">
                    <span>CONTENT</span>
                    <strong>{runtime.contentVersion ? runtime.contentVersion.slice(0, 72) : session.board_id ? "Waiting for player version" : "Legacy Layout playback"}</strong>
                  </div>

                  {displayHealth?.last_error_message_safe && (
                    <div className="scena-session-display__error">{displayHealth.last_error_message_safe}</div>
                  )}

                  <footer className="scena-session-output__controls">
                    <div className="scena-session-output__route">
                    {usesSharedLayout ? (
                      <span>Shared layout: {session.shared_layout_id ? (layoutNames.get(session.shared_layout_id) ?? "Unknown") : "Not set"}</span>
                    ) : composable ? (
                      locationLayouts === null ? <Skeleton height={36} /> : locationLayouts.length === 0 ? (
                        <span>No Layouts yet — <Link to="/app/layouts">create one</Link></span>
                      ) : (
                      <div>
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
                    ) : <span>Layout: {screen.layout_id ? (layoutNames.get(screen.layout_id) ?? "Unknown") : "Not set"}</span>}
                    </div>
                    <div className="scena-session-output__actions">
                    {composable ? <>
                      <Switch checked={screen.is_enabled} onChange={() => toggleEnabled(screen)} label={screen.is_enabled ? "Enabled" : "Disabled"} />
                      {!screen.is_primary && (
                        <Button variant="ghost" size="sm" icon={<Star size={16} />} onClick={() => makePrimary(screen.id)}>
                          Set primary
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" icon={<Trash size={16} />} onClick={() => removeScreen(screen.id)}>
                        Remove
                      </Button>
                    </> : <span>{screen.is_enabled ? "Enabled" : "Disabled"}</span>}
                    </div>
                  </footer>
                </div>
                );
              })}
            </div>
          )}
        </Card>

      {/* Activity. Read straight from session_events, which is append-only and
          has no write policy — so this timeline cannot have been edited. */}
      <Card className="scena-session-panel scena-session-activity">
        <div className="scena-session-panel__header">
          <div className="scena-session-panel__icon"><ClockCounterClockwise size={20} weight="duotone" /></div>
          <div><span className="scena-session-eyebrow">History</span><h2>Activity</h2></div>
        </div>
        {events === null ? (
          <Skeleton height={80} />
        ) : events.length === 0 ? (
          <div style={{ fontSize: "var(--scena-text-sm)", color: "var(--scena-text-muted)" }}>
            Nothing has happened on this Session yet.
          </div>
        ) : (
          <ol className="scena-session-timeline">
            {events.map((event) => (
              <li key={event.id}>
                <span className="scena-session-timeline__marker" aria-hidden="true" />
                <time dateTime={event.occurred_at}>
                  {new Date(event.occurred_at).toLocaleString()}
                </time>
                <span className="scena-session-timeline__event">
                  {Control.sessionEventLabel(event.event_type)}
                  {event.actor_type !== "user" && (
                    <small> · {event.actor_type}</small>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
        </div>

        {/* The database remains the authority. Issues are promoted; passed
            checks remain available in one compact disclosure instead of
            consuming most of the page. */}
        {readiness && (
          <aside className="scena-session-workspace__aside">
            <Card className={`scena-session-readiness ${blockingFailures.length ? "scena-session-readiness--blocked" : "scena-session-readiness--ready"}`}>
              <div className="scena-session-readiness__hero">
                <div className="scena-session-readiness__icon">
                  {blockingFailures.length ? <Warning size={22} weight="fill" /> : <Check size={22} weight="bold" />}
                </div>
                <div>
                  <span className="scena-session-eyebrow">Start checklist</span>
                  <h2>{blockingFailures.length ? `${blockingFailures.length} change${blockingFailures.length === 1 ? "" : "s"} required` : "Ready when you are"}</h2>
                  <p>{session.status === "stopped" ? "Stopped Sessions release their Displays. Reassign one when you want to run this Session again." : blockingFailures.length ? "Resolve these items before starting playback." : "Every required check is satisfied."}</p>
                </div>
              </div>

              {(blockingFailures.length > 0 || readinessWarnings.length > 0) && (
                <ul className="scena-session-readiness__issues">
                  {[...blockingFailures, ...readinessWarnings].map((check) => (
                    <li key={check.check_key} className={check.blocking ? "is-blocking" : "is-warning"}>
                      <Warning size={16} aria-hidden="true" />
                      <span>{check.message}<span className="scena-visually-hidden">{check.blocking ? " — must be fixed" : " — warning"}</span></span>
                    </li>
                  ))}
                </ul>
              )}

              <details className="scena-session-readiness__passed">
                <summary><Check size={16} /> {passedChecks.length} checks passed</summary>
                <ul>
                  {passedChecks.map((check) => <li key={check.check_key}><Check size={14} /> <span>{check.message}</span></li>)}
                </ul>
              </details>
              {entitlements?.has_override && <div className="scena-session-readiness__override">An approved Workspace limit override is active.</div>}
            </Card>
          </aside>
        )}
      </div>

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

function UsageMetric({ icon, label, value, limit }: { icon: ReactNode; label: string; value: number; limit: number | null }) {
  const percentage = limit && limit > 0 ? Math.min(100, Math.round((value / limit) * 100)) : 0;
  const limitLabel = limit ?? "Unlimited";
  return (
    <Card className="scena-session-metric">
      <div className="scena-session-metric__icon">{icon}</div>
      <div className="scena-session-metric__copy"><span>{label}</span><strong>{value}<small> / {limitLabel}</small></strong></div>
      <div className="scena-session-metric__track" aria-label={`${label}: ${value} of ${limitLabel}`}><span style={{ width: `${percentage}%` }} /></div>
    </Card>
  );
}

function RuntimeMeter({ label, value, percentage, tone }: { label: string; value: string; percentage: number; tone: "success" | "brand" | "danger" }) {
  return (
    <div className={`scena-runtime-meter scena-runtime-meter--${tone}`}>
      <div><span>{label}</span><strong>{value}</strong></div>
      <div className="scena-runtime-meter__rail" aria-label={`${label}: ${value}`}>
        <span style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }} />
      </div>
    </div>
  );
}

function RuntimeDatum({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`scena-runtime-datum${alert ? " is-alert" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatRuntimeDuration(seconds: number | null): string {
  if (seconds === null) return "Not reported";
  const whole = Math.max(0, Math.round(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remainder = whole % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${remainder}s`;
}
