import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Broadcast, Check, Monitor, Play, Sparkle } from "@phosphor-icons/react";
import { Link, useNavigate } from "react-router-dom";
import { useManagerContext } from "../../app/ManagerContextProvider";
import * as Locations from "../../domain/locations";
import * as Screens from "../../domain/screens";
import * as Sessions from "../../domain/sessions";
import * as Boards from "../../services/scena-api/boards";
import type { DisplayMode } from "../../shared/validation";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { Select } from "../../components/ui/Select";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { DisplaySelectionOption } from "../../components/sessions/DisplaySelectionOption";
import { BoardChoiceGrid } from "../../components/sessions/BoardChoiceGrid";
import { buildSessionBoardPlan } from "./sessionBoardPlan";

const STEPS = ["Basics", "Displays", "Behavior", "Review & launch"];
const MODES: Array<{ value: DisplayMode; title: string; description: string }> = [
  { value: "single", title: "Single", description: "Use one enabled Display for this Session." },
  { value: "duplicate", title: "Duplicate", description: "Show one shared Board on every Display." },
  { value: "extend", title: "Extend", description: "Stretch one shared Board across a larger canvas." },
  { value: "independent", title: "Independent", description: "Give each Display its own Board." },
];

export function NewSessionPage() {
  const context = useManagerContext();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [locations, setLocations] = useState<Locations.Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [availableScreens, setAvailableScreens] = useState<Screens.Screen[] | null>(null);
  const [boards, setBoards] = useState<Boards.BoardSummary[] | null>(null);
  const [name, setName] = useState("");
  const [selectedScreenIds, setSelectedScreenIds] = useState<string[]>([]);
  const [screenBoards, setScreenBoards] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<DisplayMode>("single");
  const [sharedBoardId, setSharedBoardId] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      Locations.listLocations(context.workspace.id),
      Boards.listBoards(context.workspace.id),
    ]).then(([locationRows, boardResult]) => {
      setLocations(locationRows);
      setBoards(boardResult.boards);
      if (locationRows.length && !locationId) setLocationId(locationRows[0].id);
    }).catch(setError);
    // The initial location is intentionally selected only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.workspace.id]);

  useEffect(() => {
    if (!locationId) return;
    setAvailableScreens(null);
    setSelectedScreenIds([]);
    setScreenBoards({});
    Screens.listAvailableScreens(context.workspace.id, locationId)
      .then(setAvailableScreens)
      .catch(setError);
  }, [context.workspace.id, locationId]);

  const selectedScreens = useMemo(
    () => (availableScreens ?? []).filter((screen) => selectedScreenIds.includes(screen.id)),
    [availableScreens, selectedScreenIds],
  );
  const activeBoards = useMemo(() => (boards ?? []).filter((board) => board.status === "active"), [boards]);
  const needsSharedBoard = mode === "duplicate" || mode === "extend";
  const needsPerScreenBoards = mode === "single" || mode === "independent";

  function toggleScreen(screenId: string) {
    setSelectedScreenIds((current) => current.includes(screenId)
      ? current.filter((id) => id !== screenId)
      : [...current, screenId]);
  }

  function canContinue() {
    if (step === 0) return Boolean(locationId && name.trim());
    if (step === 1) return selectedScreenIds.length > 0;
    if (step === 2) {
      if (needsSharedBoard) return Boolean(sharedBoardId);
      if (mode === "single" && selectedScreenIds.length !== 1) return false;
      return !needsPerScreenBoards || selectedScreenIds.every((id) => Boolean(screenBoards[id]));
    }
    return true;
  }

  async function launch() {
    setError(null);
    setSubmitting(true);
    try {
      const draft = await Sessions.createDraftSession(context.workspace.id, locationId, name.trim());
      setCreatedSessionId(draft.id);
      const boardPlan = buildSessionBoardPlan(mode, selectedScreens.map((screen) => screen.id), sharedBoardId, screenBoards);
      await Sessions.setSessionBoard(context.workspace.id, draft.id, boardPlan.sessionBoardId);
      await Sessions.setDisplayMode(context.workspace.id, draft.id, mode, null);
      for (const [index, screen] of selectedScreens.entries()) {
        await Sessions.addScreenToSession(context.workspace.id, locationId, draft.id, {
          screen_id: screen.id,
          board_id: boardPlan.boardsByScreen[screen.id] ?? null,
          layout_id: null,
          is_primary: index === 0,
          screen_order: index,
        });
      }
      await Sessions.startSession(context.workspace.id, draft.id, context.userId);
      navigate(`/app/sessions/${draft.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="scena-page scena-container-narrow">
      <PageHeader
        title="Build a Session"
        description="Configure the displays and content first, then launch a real operating Session."
      />

      <nav aria-label="Session builder progress" style={{ display: "grid", gridTemplateColumns: `repeat(${STEPS.length}, 1fr)`, gap: 8, marginBottom: 20 }}>
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => index < step && setStep(index)}
            style={{ border: 0, borderTop: `3px solid ${index <= step ? "var(--scena-accent)" : "var(--scena-border)"}`, background: "transparent", padding: "10px 4px", textAlign: "left", cursor: index < step ? "pointer" : "default", color: index === step ? "var(--scena-text-primary)" : "var(--scena-text-muted)" }}
          >
            <div style={{ fontSize: "var(--scena-text-xs)", fontWeight: 700 }}>{String(index + 1).padStart(2, "0")}</div>
            <div style={{ fontSize: "var(--scena-text-xs)" }}>{label}</div>
          </button>
        ))}
      </nav>

      {error ? <ErrorBanner error={error} onRetry={() => setError(null)} /> : null}
      {createdSessionId && error ? (
        <Card style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span>Your draft was saved. Finish or inspect it from the Session manager.</span>
          <Button variant="secondary" onClick={() => navigate(`/app/sessions/${createdSessionId}`)}>Open saved draft</Button>
        </Card>
      ) : null}

      <Card style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {step === 0 && (
          <>
            <div><Sparkle size={28} weight="duotone" /><h2 style={{ margin: "8px 0 4px" }}>Start with the basics</h2><p style={{ margin: 0, color: "var(--scena-text-secondary)" }}>Give this operating session a home and a name.</p></div>
            <Field label="Location"><Select value={locationId} onChange={(event) => setLocationId(event.target.value)} options={[{ value: "", label: "Select a location" }, ...locations.map((location) => ({ value: location.id, label: location.name }))]} /></Field>
            <Field label="Session name"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Evening rotation" autoFocus /></Field>
          </>
        )}

        {step === 1 && (
          <>
            <div><Monitor size={28} weight="duotone" /><h2 style={{ margin: "8px 0 4px" }}>Choose the displays</h2><p style={{ margin: 0, color: "var(--scena-text-secondary)" }}>Only paired, ready displays at this location are available.</p></div>
            {availableScreens === null ? <Skeleton height={80} /> : availableScreens.length === 0 ? <p style={{ color: "var(--scena-warning)" }}>No ready displays are available at this location yet. Pair a display first, then return here.</p> : (
              <div className="scena-session-display-options">
                {availableScreens.map((screen) => {
                  const selected = selectedScreenIds.includes(screen.id);
                  return (
                    <DisplaySelectionOption
                      key={screen.id}
                      name={screen.name}
                      selected={selected}
                      onToggle={() => toggleScreen(screen.id)}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div><h2 style={{ margin: 0 }}>Choose display behavior</h2><p style={{ margin: "6px 0 0", color: "var(--scena-text-secondary)" }}>Scena will translate this choice into the correct session and screen assignments.</p></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              {MODES.map((option) => <button key={option.value} type="button" onClick={() => setMode(option.value)} style={{ textAlign: "left", padding: 14, border: `1px solid ${mode === option.value ? "var(--scena-accent)" : "var(--scena-border)"}`, background: mode === option.value ? "var(--scena-surface-2)" : "transparent", borderRadius: "var(--scena-radius-md)", cursor: "pointer" }}><strong>{option.title}</strong><div style={{ marginTop: 6, fontSize: "var(--scena-text-xs)", color: "var(--scena-text-secondary)" }}>{option.description}</div></button>)}
            </div>
            {boards === null ? <Skeleton height={120} /> : activeBoards.length === 0 ? (
              <EmptyState
                icon={<Broadcast size={32} />}
                title="Create a Board first"
                description="Sessions play Boards. Build a Board with at least one Scene, then return here to route it to your Displays."
                action={<Link to="/app/boards/new"><Button variant="secondary" size="sm">Create a Board</Button></Link>}
              />
            ) : needsSharedBoard ? (
              <BoardChoiceGrid
                label="Board for every Display"
                hint={mode === "extend" ? "Scena will crop this Board across the arranged Display canvas." : "Every selected Display will play this Board in sync."}
                boards={activeBoards}
                value={sharedBoardId}
                onChange={setSharedBoardId}
              />
            ) : (
              <div className="scena-session-board-assignments">
                {selectedScreens.map((screen) => (
                  <BoardChoiceGrid
                    key={screen.id}
                    label={`${screen.name} Board`}
                    hint="Choose the Board this Display should play."
                    boards={activeBoards}
                    value={screenBoards[screen.id] ?? ""}
                    onChange={(value) => setScreenBoards((current) => ({ ...current, [screen.id]: value }))}
                  />
                ))}
              </div>
            )}
            {mode === "single" && selectedScreens.length !== 1 ? <p style={{ margin: 0, color: "var(--scena-warning)", fontSize: "var(--scena-text-sm)" }}>Single mode requires exactly one selected display.</p> : null}
          </>
        )}

        {step === 3 && (
          <>
            <div><h2 style={{ margin: 0 }}>Review and launch</h2><p style={{ margin: "6px 0 0", color: "var(--scena-text-secondary)" }}>This will create the draft, assign its displays and content, validate it, and start it.</p></div>
            <div style={{ display: "grid", gap: 10, fontSize: "var(--scena-text-sm)" }}>
              <div><strong>Name</strong><br />{name}</div><div><strong>Location</strong><br />{locations.find((location) => location.id === locationId)?.name ?? "—"}</div><div><strong>Behavior</strong><br />{MODES.find((option) => option.value === mode)?.title} · {selectedScreens.length} Display{selectedScreens.length === 1 ? "" : "s"}</div><div><strong>Content</strong><br />{needsSharedBoard ? activeBoards.find((board) => board.id === sharedBoardId)?.name ?? "Selected Board" : selectedScreens.map((screen) => `${screen.name}: ${activeBoards.find((board) => board.id === screenBoards[screen.id])?.name ?? "Not assigned"}`).join(" · ")}</div>
            </div>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 8 }}>
          <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => step === 0 ? navigate("/app/sessions") : setStep(step - 1)} disabled={submitting}>{step === 0 ? "Cancel" : "Back"}</Button>
          {step < STEPS.length - 1 ? <Button variant="primary" icon={<ArrowRight size={16} />} onClick={() => setStep(step + 1)} disabled={!canContinue()}>Continue</Button> : <Button variant="primary" icon={<Play size={16} />} loading={submitting} onClick={() => void launch()} disabled={!canContinue()}>Launch Session</Button>}
        </div>
      </Card>
    </div>
  );
}
