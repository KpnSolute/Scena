// Scena kiosk display — the route a screen opens at /display (legacy
// #/display is rewritten to this path by the compatibility bootstrap in
// src/main.tsx before the router mounts).
//
// Relocated from src/Display.tsx during the routing pass — every line of
// logic below includes device registration, pairing state, polling, offline
// cache, invalidation subscription, layout/tile rendering, and bounded runtime
// telemetry. Diagnostics render in the Manager control room, never over
// customer content. Isolated from the manager route tree by construction: this
// file imports only from src/lib/display.ts, never from src/auth/* or
// src/app/* — the kiosk holds no Supabase session and no manager
// JWT, ever.

import { useEffect, useRef, useState } from "react";
import { pollState, registerDevice, storedToken, subscribeToOrgInvalidation, type DisplayPollMetrics, type DisplayState } from "../lib/display";
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
  const registering = useRef(false);
  const bootedAt = useRef(Date.now());
  const runtime = useRef<DisplayPollMetrics>({ poll_error_count: 0, cache_source: "live" });

  function runtimeSnapshot(): DisplayPollMetrics {
    return {
      ...runtime.current,
      uptime_seconds: Math.max(0, Math.round((Date.now() - bootedAt.current) / 1000)),
    };
  }

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
        const { state: next, fromCache: cached } = await pollState(runtimeSnapshot());
        if (!active) return;
        runtime.current.poll_latency_ms = Math.round(performance.now() - started);
        runtime.current.poll_error_count = cached ? (runtime.current.poll_error_count ?? 0) + 1 : 0;
        runtime.current.cache_source = cached ? "cached" : "live";
        setFromCache(cached);
        setPollError(runtime.current.poll_error_count);
        if (next.status === "unknown_device" || next.status === "revoked") {
          setPairCode(null);
          setState(next);
          await ensureRegistered();
          return;
        }
        setState(next);
      } catch {
        runtime.current.poll_error_count = (runtime.current.poll_error_count ?? 0) + 1;
        runtime.current.cache_source = "cached";
        if (active) setPollError(runtime.current.poll_error_count);
      }
    }
    tick();
    const iv = setInterval(tick, POLL_MS);
    return () => { active = false; clearInterval(iv); };
  }, []);

  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const measure = (time: number) => {
      frames += 1;
      if (time - last >= 1000) {
        runtime.current.fps = Math.round((frames * 1000) / (time - last));
        frames = 0;
        last = time;
      }
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
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
      const started = performance.now();
      pollState(runtimeSnapshot()).then(({ state: s, fromCache: cached }) => {
        runtime.current.poll_latency_ms = Math.round(performance.now() - started);
        runtime.current.poll_error_count = cached ? (runtime.current.poll_error_count ?? 0) + 1 : 0;
        runtime.current.cache_source = cached ? "cached" : "live";
        setPollError(runtime.current.poll_error_count);
        setState(s);
        setFromCache(cached);
      }).catch(() => {
        runtime.current.poll_error_count = (runtime.current.poll_error_count ?? 0) + 1;
        setPollError(runtime.current.poll_error_count);
      });
    });
  }, [orgId]);

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
  </div>;
}

/** Plain positioned-box renderer — proves layout/tile/viewport/rotation
 * resolution end to end without investing in kiosk visual polish. */
export function LayoutRenderer({ state }: { state: Extract<DisplayState, { status: "showing" }> }) {
  const { layout, viewport, rotation_degrees } = state;
  const isExtendedViewport = state.display_mode === "extend" && (viewport.x !== 0 || viewport.y !== 0 || viewport.width !== 100 || viewport.height !== 100);
  return <div
    className="layout-canvas"
    style={{
      position: "relative",
      width: "100vw",
      height: "100vh",
      background: state.board?.background_color ?? layout?.background_color ?? "#000000",
      overflow: "hidden",
      transform: rotation_degrees ? `rotate(${rotation_degrees}deg)` : undefined,
    }}
  >
    <div style={isExtendedViewport ? {
      position: "absolute",
      left: `${-100 * viewport.x / viewport.width}%`,
      top: `${-100 * viewport.y / viewport.height}%`,
      width: `${10_000 / viewport.width}%`,
      height: `${10_000 / viewport.height}%`,
    } : { position: "absolute", inset: 0 }}>
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
    </div>
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
