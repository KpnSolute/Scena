import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Monitor, Play, Sparkle } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { useManagerContext } from "../../app/ManagerContextProvider";
import * as Locations from "../../domain/locations";
import * as Screens from "../../domain/screens";
import * as Sessions from "../../domain/sessions";
import * as Layouts from "../../domain/layouts";
import * as Boards from "../../services/scena-api/boards";
import type { DisplayMode } from "../../shared/validation";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { Select } from "../../components/ui/Select";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { Skeleton } from "../../components/ui/Skeleton";

const STEPS = ["Basics", "Displays", "Behavior", "Review & launch"];
const MODES: Array<{ value: DisplayMode; title: string; description: string }> = [
  { value: "single", title: "Single", description: "Use one enabled display for this session." },
  { value: "duplicate", title: "Duplicate", description: "Show one shared layout on every display." },
  { value: "extend", title: "Extend", description: "Use one shared layout across a larger canvas." },
  { value: "independent", title: "Independent", description: "Give each display its own layout." },
];

export function NewSessionPage() {
  const context = useManagerContext();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [locations, setLocations] = useState<Locations.Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [availableScreens, setAvailableScreens] = useState<Screens.Screen[] | null>(null);
  const [layouts, setLayouts] = useState<Layouts.Layout[] | null>(null);
  const [boards, setBoards] = useState<Boards.BoardSummary[] | null>(null);
  const [name, setName] = useState("");
  const [selectedScreenIds, setSelectedScreenIds] = useState<string[]>([]);
  const [screenLayouts, setScreenLayouts] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<DisplayMode>("single");
  const [sharedLayoutId, setSharedLayoutId] = useState("");
  const [boardId, setBoardId] = useState("");
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
    setLayouts(null);
    setSelectedScreenIds([]);
    setScreenLayouts({});
    Promise.all([
      Screens.listAvailableScreens(context.workspace.id, locationId),
      Layouts.listLayouts(context.workspace.id, locationId),
    ]).then(([screenRows, layoutRows]) => {
      setAvailableScreens(screenRows);
      setLayouts(layoutRows);
    }).catch(setError);
  }, [context.workspace.id, locationId]);

  const selectedScreens = useMemo(
    () => (availableScreens ?? []).filter((screen) => selectedScreenIds.includes(screen.id)),
    [availableScreens, selectedScreenIds],
  );
  const needsSharedLayout = mode === "duplicate" || mode === "extend";
  const needsPerScreenLayouts = mode === "single" || mode === "independent";

  function toggleScreen(screenId: string) {
    setSelectedScreenIds((current) => current.includes(screenId)
      ? current.filter((id) => id !== screenId)
      : [...current, screenId]);
  }

  function canContinue() {
    if (step === 0) return Boolean(locationId && name.trim());
    if (step === 1) return selectedScreenIds.length > 0;
    if (step === 2) {
      if (needsSharedLayout) return Boolean(sharedLayoutId);
      if (mode === "single" && selectedScreenIds.length !== 1) return false;
      return !needsPerScreenLayouts || selectedScreenIds.every((id) => Boolean(screenLayouts[id]));
    }
    return true;
  }

  async function launch() {
    setError(null);
    setSubmitting(true);
    try {
      const draft = await Sessions.createDraftSession(context.workspace.id, locationId, name.trim());
      setCreatedSessionId(draft.id);
      await Sessions.setDisplayMode(context.workspace.id, draft.id, mode, needsSharedLayout ? sharedLayoutId : null);
      if (boardId) await Sessions.setSessionBoard(context.workspace.id, draft.id, boardId);
      for (const [index, screen] of selectedScreens.entries()) {
        await Sessions.addScreenToSession(context.workspace.id, locationId, draft.id, {
          screen_id: screen.id,
          layout_id: needsPerScreenLayouts ? screenLayouts[screen.id] : null,
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
              <div style={{ display: "grid", gap: 10 }}>
                {availableScreens.map((screen) => {
                  const selected = selectedScreenIds.includes(screen.id);
                  return <label key={screen.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, border: `1px solid ${selected ? "var(--scena-accent)" : "var(--scena-border)"}`, borderRadius: "var(--scena-radius-md)", cursor: "pointer" }}>
                    <input type="checkbox" checked={selected} onChange={() => toggleScreen(screen.id)} />
                    <Monitor size={20} /><span style={{ flex: 1, fontWeight: 600 }}>{screen.name}</span><span style={{ color: "var(--scena-success)", fontSize: "var(--scena-text-xs)" }}>Ready</span>
                  </label>;
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
            {layouts === null ? <Skeleton height={40} /> : needsSharedLayout ? <Field label="Shared layout" hint="This layout will be used by every selected display."><Select value={sharedLayoutId} onChange={(event) => setSharedLayoutId(event.target.value)} options={[{ value: "", label: "Select a layout" }, ...layouts.map((layout) => ({ value: layout.id, label: layout.name }))]} /></Field> : <div style={{ display: "grid", gap: 14 }}>{selectedScreens.map((screen) => <Field key={screen.id} label={`${screen.name} layout`}><Select value={screenLayouts[screen.id] ?? ""} onChange={(event) => setScreenLayouts((current) => ({ ...current, [screen.id]: event.target.value }))} options={[{ value: "", label: "Select a layout" }, ...layouts.map((layout) => ({ value: layout.id, label: layout.name }))]} /></Field>)}</div>}
            {mode === "single" && selectedScreens.length !== 1 ? <p style={{ margin: 0, color: "var(--scena-warning)", fontSize: "var(--scena-text-sm)" }}>Single mode requires exactly one selected display.</p> : null}
          </>
        )}

        {step === 3 && (
          <>
            <div><h2 style={{ margin: 0 }}>Review and launch</h2><p style={{ margin: "6px 0 0", color: "var(--scena-text-secondary)" }}>This will create the draft, assign its displays and content, validate it, and start it.</p></div>
            <div style={{ display: "grid", gap: 10, fontSize: "var(--scena-text-sm)" }}>
              <div><strong>Name</strong><br />{name}</div><div><strong>Location</strong><br />{locations.find((location) => location.id === locationId)?.name ?? "—"}</div><div><strong>Behavior</strong><br />{MODES.find((option) => option.value === mode)?.title} · {selectedScreens.length} display{selectedScreens.length === 1 ? "" : "s"}</div><div><strong>Content</strong><br />{boardId ? boards?.find((board) => board.id === boardId)?.name ?? "Selected Board" : "Layout playback"}</div>
            </div>
            {boards === null ? <Skeleton height={40} /> : <Field label="Optional Board" hint="A Board can provide live scene content. Leave empty to use the selected Layout playback."><Select value={boardId} onChange={(event) => setBoardId(event.target.value)} options={[{ value: "", label: "Use Layout playback" }, ...boards.filter((board) => board.status === "active").map((board) => ({ value: board.id, label: board.name }))]} /></Field>}
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
