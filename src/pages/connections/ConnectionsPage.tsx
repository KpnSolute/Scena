import { useEffect, useState } from "react";
import { ArrowsClockwise, PlugsConnected, Plus } from "@phosphor-icons/react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";
import {
  contentSourceWebhookUrl,
  createContentSource,
  createKpnSoluteContentSource,
  listContentSources,
  rotateContentSource,
  type ContentSource,
  type WebhookCredential,
} from "../../services/scena-api/contentSources";

export function ConnectionsPage() {
  const context = useManagerContext();
  const toast = useToast();
  const [sources, setSources] = useState<ContentSource[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("Othniel cafe menu");
  const [connectionKind, setConnectionKind] = useState<"kpnsolute" | "webhook">("kpnsolute");
  const [tenantId, setTenantId] = useState("mjcc");
  const [eventType, setEventType] = useState("content.updated");
  const [credential, setCredential] = useState<WebhookCredential | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError(null);
    listContentSources(context.workspace.id).then(setSources).catch(setError);
  };
  useEffect(load, [context.workspace.id]);

  async function create() {
    setBusy(true);
    try {
      if (connectionKind === "webhook") {
        const result = await createContentSource(context.workspace.id, name, eventType);
        setCredential(result.credential);
      } else {
        await createKpnSoluteContentSource(context.workspace.id, name, tenantId);
      }
      setCreateOpen(false);
      toast.show(connectionKind === "webhook" ? "Webhook address created." : "KpnSolute Events connection created.", "success");
      load();
    } catch (caught) {
      toast.show(caught instanceof Error ? caught.message : "Couldn’t create connection.", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function rotate(source: ContentSource) {
    setBusy(true);
    try {
      const result = await rotateContentSource(context.workspace.id, source.id);
      if (result.credential) setCredential(result.credential);
      else toast.show("CloudEvents signing secret rotated.", "success");
    } catch (caught) {
      toast.show(caught instanceof Error ? caught.message : "Couldn’t rotate credential.", "danger");
    } finally {
      setBusy(false);
    }
  }

  return <div className="scena-page">
    <PageHeader title="Connections" description="Give any external data source a secure Scena address, or connect a managed KpnSolute feed." actions={<Button variant="primary" icon={<Plus size={18} />} onClick={() => setCreateOpen(true)}>New connection</Button>} />
    {error ? <ErrorBanner error={error} onRetry={load} /> : !sources ? <Skeleton height={90} /> : sources.length === 0 ? (
      <EmptyState icon={<PlugsConnected size={32} />} title="No Connections yet" description="Create an incoming webhook address or connect a tenant’s KpnCompute menu." action={<Button variant="primary" onClick={() => setCreateOpen(true)}>New connection</Button>} />
    ) : <div className="scena-card-grid">{sources.map((source) => <article key={source.id} className="scena-card">
      <div className="scena-card__header"><div><h3>{source.name}</h3><p>{source.accepted_event_type}</p></div><span className="scena-badge">{source.status}</span></div>
      <dl className="scena-definition-list">
        <div><dt>Protocol</dt><dd>{source.protocol === "kpnsolute-events-v1" ? "Managed KpnSolute feed" : "Incoming webhook"}</dd></div>
        {source.protocol === "legacy" && <div><dt>Webhook address</dt><dd><code>{contentSourceWebhookUrl(source.id) ?? "Scena API is not configured"}</code></dd></div>}
        {source.external_tenant_id && <div><dt>Tenant</dt><dd><code>{source.external_tenant_id}</code></dd></div>}
        <div><dt>Connection ID</dt><dd><code>{source.id}</code></dd></div>
        <div><dt>Version</dt><dd>{source.current_version}</dd></div>
        <div><dt>Last received</dt><dd>{source.last_received_at ? new Date(source.last_received_at).toLocaleString() : "Waiting for first event"}</dd></div>
      </dl>
      <Button variant="secondary" size="sm" icon={<ArrowsClockwise size={16} />} disabled={busy} onClick={() => rotate(source)}>Rotate signing secret</Button>
    </article>)}</div>}
    <Modal open={createOpen} title="New data connection" onClose={() => setCreateOpen(false)} footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button><Button variant="primary" loading={busy} disabled={!name.trim() || (connectionKind === "kpnsolute" ? !tenantId.trim() : !eventType.trim())} onClick={create}>{connectionKind === "webhook" ? "Create webhook" : "Connect"}</Button></>}>
      <Field label="Connection type">
        <Select value={connectionKind} onChange={(event) => setConnectionKind(event.target.value as "kpnsolute" | "webhook")} options={[{ value: "kpnsolute", label: "KpnSolute menu feed" }, { value: "webhook", label: "Incoming webhook" }]} />
      </Field>
      <Field label="Connection name"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
      {connectionKind === "kpnsolute" ? <>
        <Field label="KpnSolute tenant ID"><Input value={tenantId} onChange={(event) => setTenantId(event.target.value.toLowerCase())} /></Field>
        <p className="scena-help">Scena registers a signed CloudEvents endpoint for this tenant and keeps its menu snapshot current automatically.</p>
      </> : <>
        <Field label="Event type"><Input value={eventType} onChange={(event) => setEventType(event.target.value)} placeholder="content.updated" /></Field>
        <p className="scena-help">Scena will create a unique HTTPS address and one-time bearer secret. Your provider sends JSON updates to that address; it never needs database access.</p>
      </>}
    </Modal>
    <Modal open={Boolean(credential)} title="Save this credential now" onClose={() => setCredential(null)} footer={<Button variant="primary" onClick={() => setCredential(null)}>I saved it</Button>}>
      {credential && <div className="scena-credential"><p>This bearer secret cannot be viewed again. Store it in the sending system, never in browser code.</p><Field label="Webhook address"><Input readOnly value={credential.url} /></Field><Field label="Connection ID"><Input readOnly value={credential.source_id} /></Field><Field label="Bearer secret"><Input readOnly value={credential.secret} /></Field><pre>{JSON.stringify(credential.event_shape, null, 2)}</pre></div>}
    </Modal>
  </div>;
}
