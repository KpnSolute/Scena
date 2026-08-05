// Scena kiosk display — the route a screen opens at /display (legacy
// #/display is rewritten to this path by the compatibility bootstrap in
// src/main.tsx before the router mounts).
//
// Relocated from src/Display.tsx during the routing pass — every line of
// logic below is unchanged: device registration, pairing state, polling,
// offline cache, invalidation subscription, layout/tile rendering, debug
// overlay. Isolated from the manager route tree by construction: this
// file imports only from src/lib/display.ts, never from src/auth/* or
// src/app/* — the kiosk holds no Supabase session and no manager
// JWT, ever.

import { useEffect, useRef, useState } from "react";
import { forgetDevice, pollState, registerDevice, storedToken, subscribeToOrgInvalidation, type DisplayState } from "../lib/display";
import { ScenaMark } from "../components/brand/ScenaMark";
import { BoardRenderer } from "./BoardRenderer";

// Brand lockup shown on every non-showing kiosk state. Pure presentation —
// ScenaMark imports nothing from src/auth/* or src/app/*, so the kiosk
// isolation rule documented in src/app/router.tsx still holds.
function DisplayBrand() {
  return <div className="display-brand">
    <span className="display-brand__mark"><ScenaMark size={44} /></span>
    <span className="display-brand__word">SCENA</span>
  </div>;
}

const POLL_MS = 4000;

export function DisplayRoute() {
  const [state, setState] = useState<DisplayState | null>(null);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [pollError, setPollError] = useState(0);
  const [fromCache, setFromCache] = useState(false);
  const [lastPoll, setLastPoll] = useState<{ at: number; ms: number } | null>(null);
  const [debug, setDebug] = useState(() => new URLSearchParams(window.location.search).has("debug"));
  const registering = useRef(false);

  async function ensureRegistered() {
    if (registering.current) return;
    registering.current = true;
    try {
      const next = await registerDevice();
      setPairCode(next.code);
      setState({ status: "pending" });
    } catch {
      setPollError((n) => n + 1);
    } finally {
      registering.current = false;
    }
  }

  useEffect(() => {
    let active = true;
    async function tick() {
      if (!storedToken()) { await ensureRegistered(); return; }
      const started = performance.now();
      try {
        const { state: next, fromCache: cached } = await pollState();
        if (!active) return;
        setLastPoll({ at: Date.now(), ms: Math.round(performance.now() - started) });
        setFromCache(cached);
        setPollError(cached ? (n) => n + 1 : 0);
        if (next.status === "unknown_device" || next.status === "revoked") {
          setPairCode(null);
          setState(next);
          await ensureRegistered();
          return;
        }
        setState(next);
      } catch {
        if (active) setPollError((n) => n + 1);
      }
    }
    tick();
    const iv = setInterval(tick, POLL_MS);
    return () => { active = false; clearInterval(iv); };
  }, []);

  // Realtime hint: subscribed to the screen's org-scoped invalidation
  // broadcast (see src/lib/display.ts#subscribeToOrgInvalidation). This is
  // Realtime *Broadcast*, not `postgres_changes` — this kiosk connection
  // has no Supabase session, so it holds no RLS grant to receive
  // `postgres_changes` events on any table at all. The broadcast payload
  // is untrusted and carries no data; it only triggers an immediate
  // authoritative re-fetch via display-gateway, same as every interval
  // poll. Missing org_id (not yet claimed) means there's nothing to
  // subscribe to yet — the 4s interval poll keeps working regardless and
  // will pick up org_id the moment the screen is claimed.
  const orgId = state && "org_id" in state ? state.org_id : null;
  useEffect(() => {
    if (!orgId) return;
    return subscribeToOrgInvalidation(orgId, () => {
      pollState().then(({ state: s, fromCache: cached }) => { setState(s); setFromCache(cached); }).catch(() => {});
    });
  }, [orgId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === "d") setDebug((d) => !d); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const offline = pollError >= 3;

  return <div className="display-root">
    {state?.status === "showing"
      ? <LayoutRenderer state={state} />
      : state?.status === "standby"
      ? <div className="display-center">
          <DisplayBrand />
          <p className="display-dim display-status"><span className="status-dot" aria-hidden="true" />{state.screen_name} · standby — no scene is live</p>
        </div>
      : <div className="display-center">
          <DisplayBrand />
          {pairCode ? <>
            <p className="display-dim">Enter this code in the Scena control room to pair this screen</p>
            <div className="pair-code">{pairCode}</div>
            <p className="display-faint">This code expires in 30 minutes · this screen stays unpaired until claimed</p>
          </> : <p className="display-dim">Connecting…</p>}
        </div>}
    {offline && <div className="display-offline">{fromCache ? "Reconnecting — showing cached content" : "Reconnecting…"}</div>}
    {debug && <DebugOverlay state={state} lastPoll={lastPoll} pollError={pollError} fromCache={fromCache} />}
    {!debug && <div className="debug-hint">press D for diagnostics</div>}
  </div>;
}

/** Plain positioned-box renderer — proves layout/tile/viewport/rotation
 * resolution end to end without investing in kiosk visual polish. */
export function LayoutRenderer({ state }: { state: Extract<DisplayState, { status: "showing" }> }) {
  const { layout, viewport, rotation_degrees } = state;
  return <div
    className="layout-canvas"
    style={{
      position: "relative",
      width: "100vw",
      height: "100vh",
      background: state.board?.background_color ?? layout?.background_color ?? "#000000",
      overflow: "hidden",
      transform: rotation_degrees ? `rotate(${rotation_degrees}deg)` : undefined,
      clipPath: `inset(${viewport.y}% ${100 - viewport.x - viewport.width}% ${100 - viewport.y - viewport.height}% ${viewport.x}%)`,
    }}
  >
    {state.board ? <BoardRenderer board={state.board} /> : layout?.tiles.filter((t) => t.is_visible).map((tile) => (
      <div
        key={tile.id}
        style={{
          position: "absolute",
          left: `${tile.x_percent}%`,
          top: `${tile.y_percent}%`,
          width: `${tile.width_percent}%`,
          height: `${tile.height_percent}%`,
          zIndex: tile.z_index,
          overflow: "auto",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          padding: 12,
        }}
      >
        <TileContent content={tile.content} />
      </div>
    ))}
  </div>;
}

function TileContent({ content }: { content: unknown }) {
  const c = content as { scene_type?: string; menu?: { name: string; sections: Array<{ name: string; items: Array<{ name: string; price: number }> }> }; manifest_key?: string; slide_count?: number } | null;
  if (!c) return null;
  if (c.scene_type === "menu" && c.menu) {
    return <div>
      <h2 style={{ margin: "0 0 8px" }}>{c.menu.name}</h2>
      {c.menu.sections.map((section) => <div key={section.name} style={{ marginBottom: 12 }}>
        <h3 style={{ margin: "0 0 4px", opacity: 0.8 }}>{section.name}</h3>
        {section.items.map((item) => <div key={item.name} style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{item.name}</span><span>${item.price.toFixed(2)}</span>
        </div>)}
      </div>)}
    </div>;
  }
  if (c.scene_type === "powerpoint") {
    return <div>Presentation ready — {c.slide_count} slide{c.slide_count === 1 ? "" : "s"} (manifest {c.manifest_key})</div>;
  }
  return null;
}

function DebugOverlay({ state, lastPoll, pollError, fromCache }: { state: DisplayState | null; lastPoll: { at: number; ms: number } | null; pollError: number; fromCache: boolean }) {
  const [fps, setFps] = useState(0);
  const [now, setNow] = useState(Date.now());
  const bootedAt = useRef(Date.now());

  useEffect(() => {
    let frames = 0, last = performance.now(), raf = 0;
    const loop = (t: number) => {
      frames++;
      if (t - last >= 1000) { setFps(Math.round(frames * 1000 / (t - last))); frames = 0; last = t; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => { cancelAnimationFrame(raf); clearInterval(iv); };
  }, []);

  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string; downlink?: number } };
  const token = storedToken();
  const pollAge = lastPoll ? Math.round((now - lastPoll.at) / 1000) : null;
  const uptime = Math.round((now - bootedAt.current) / 1000);
  const rows: Array<[string, string]> = [
    ["fps", String(fps)],
    ["status", state?.status ?? "booting"],
    ["mode", state?.status === "showing" ? state.display_mode : "—"],
    ["content version", state?.status === "showing" ? state.content_version.slice(0, 24) + "…" : "—"],
    ["cache", fromCache ? "SERVING CACHED STATE" : "live"],
    ["poll", lastPoll ? `${lastPoll.ms}ms · ${pollAge}s ago` : "—"],
    ["poll errors", String(pollError)],
    ["uptime", `${Math.floor(uptime / 60)}m ${uptime % 60}s`],
    ["resolution", `${window.screen.width}×${window.screen.height} @ ${window.devicePixelRatio}x`],
    ["cpu cores", String(navigator.hardwareConcurrency ?? "?")],
    ["memory", nav.deviceMemory ? `≥${nav.deviceMemory} GB` : "n/a"],
    ["network", nav.connection ? `${nav.connection.effectiveType ?? "?"} · ${nav.connection.downlink ?? "?"} Mbps` : navigator.onLine ? "online" : "offline"],
    ["device token", token ? `…${token.slice(-8)}` : "none"],
  ];
  return <div className="debug-overlay">
    <div className="debug-title">SCENA DISPLAY DIAGNOSTICS</div>
    {rows.map(([k, v]) => <div className="debug-row" key={k}><span>{k}</span><b>{v}</b></div>)}
  </div>;
}
