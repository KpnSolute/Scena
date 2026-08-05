// /app/screens/pair — real claim flow, extracted from src/App.tsx's
// ScreensPanel inline form. Calls screen-claim, the same Edge Function,
// unchanged.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowSquareOut, Check, Copy, DeviceMobile, Monitor } from "@phosphor-icons/react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { callEdgeFunction } from "../../services/supabase/client";
import * as Locations from "../../domain/locations";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { Select } from "../../components/ui/Select";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ErrorBanner } from "../../components/ui/ErrorBanner";

export function PairScreenPage() {
  const context = useManagerContext();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Locations.Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const displayUrl = `${window.location.origin}/display`;

  useEffect(() => {
    Locations.listLocations(context.workspace.id).then((rows) => {
      setLocations(rows);
      if (rows.length && !locationId) setLocationId(rows[0].id);
    }).catch(setError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.workspace.id]);

  async function claim() {
    setError(null);
    setSubmitting(true);
    try {
      await callEdgeFunction("screen-claim", { code, name, location_id: locationId });
      navigate("/app/screens");
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function copyDisplayUrl() {
    try {
      await navigator.clipboard.writeText(displayUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(new Error("Copy failed. Select the player address and copy it manually."));
    }
  }

  return (
    <div className="scena-page scena-container-narrow scena-pairing">
      <PageHeader title="Pair a Display" description="Choose where this Display will run, then connect it to your Workspace." />

      <section className="scena-pairing__paths" aria-label="Display setup options">
        <Card className="scena-pairing__path scena-pairing__path--remote">
          <div className="scena-pairing__path-icon"><Monitor size={24} weight="duotone" /></div>
          <div>
            <span className="scena-pairing__eyebrow">Another screen</span>
            <h2>Open the Scena player</h2>
            <p>On the TV, tablet, or computer you want to use, open this address. A six-digit code will appear.</p>
          </div>
          <div className="scena-pairing__url-row">
            <a href={displayUrl} target="_blank" rel="noreferrer" className="scena-pairing__url">
              {displayUrl}<ArrowSquareOut size={16} aria-hidden="true" />
            </a>
            <Button variant="secondary" size="sm" icon={copied ? <Check size={16} /> : <Copy size={16} />} onClick={copyDisplayUrl}>
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        </Card>

        <Card className="scena-pairing__path scena-pairing__path--current">
          <div className="scena-pairing__path-icon"><DeviceMobile size={24} weight="duotone" /></div>
          <div>
            <span className="scena-pairing__eyebrow">This device</span>
            <h2>Use this device as a Display</h2>
            <p>Open the player in a new tab on this browser. Keep this setup page open so you can enter the code it shows.</p>
          </div>
          <a
            href="/display"
            target="_blank"
            rel="noreferrer"
            className="scena-btn scena-btn--primary scena-btn--lg scena-pairing__launch"
            onClick={() => { if (!name) setName("This device"); }}
          >
            <Monitor size={18} /> Open player on this device <ArrowSquareOut size={16} />
          </a>
        </Card>
      </section>

      <Card className="scena-pairing__claim">
        <div className="scena-pairing__claim-header">
          <span className="scena-pairing__step">Next</span>
          <div><h2>Connect the Display</h2><p>Enter the code from the player and give this screen a recognizable name.</p></div>
        </div>
        {error ? <ErrorBanner error={error} /> : null}

        <Field label="Location">
          <Select
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
            options={[{ value: "", label: "Select a location" }, ...locations.map((location) => ({ value: location.id, label: location.name }))]}
          />
        </Field>

        <Field label="Pairing code" hint="The six-digit code currently shown in the Scena player.">
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            placeholder="123456"
            style={{ fontFamily: "var(--scena-font-mono)", fontSize: "var(--scena-text-xl)", letterSpacing: "0.3em", textAlign: "center" }}
          />
        </Field>

        <Field label="Display name">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Front Counter" />
        </Field>

        <Button
          variant="primary"
          block
          icon={<Monitor size={18} />}
          disabled={!locationId || code.length !== 6 || !name}
          loading={submitting}
          onClick={claim}
        >
          Pair Display
        </Button>
      </Card>
    </div>
  );
}
