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
import { Skeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";
import {
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
  const [tenantId, setTenantId] = useState("mjcc");
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
      await createKpnSoluteContentSource(context.workspace.id, name, tenantId);
      setCreateOpen(false);
      toast.show("KpnSolute Events connection created.", "success");
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
    <PageHeader title="Connections" description="Bring tenant menu data into Boards through signed CloudEvents." actions={<Button variant="primary" icon={<Plus size={18} />} onClick={() => setCreateOpen(true)}>New connection</Button>} />
    {error ? <ErrorBanner error={error} onRetry={load} /> : !sources ? <Skeleton height={90} /> : sources.length === 0 ? (
      <EmptyState icon={<PlugsConnected size={32} />} title="No Connections yet" description="Connect a tenant’s KpnCompute menu through KpnSolute Events." action={<Button variant="primary" onClick={() => setCreateOpen(true)}>New connection</Button>} />
    ) : <div className="scena-card-grid">{sources.map((source) => <article key={source.id} className="scena-card">
      <div className="scena-card__header"><div><h3>{source.name}</h3><p>{source.accepted_event_type}</p></div><span className="scena-badge">{source.status}</span></div>
      <dl className="scena-definition-list">
        <div><dt>Protocol</dt><dd>{source.protocol === "kpnsolute-events-v1" ? "CloudEvents 1.0" : "Legacy webhook"}</dd></div>
        {source.external_tenant_id && <div><dt>Tenant</dt><dd><code>{source.external_tenant_id}</code></dd></div>}
        <div><dt>Connection ID</dt><dd><code>{source.id}</code></dd></div>
        <div><dt>Version</dt><dd>{source.current_version}</dd></div>
        <div><dt>Last received</dt><dd>{source.last_received_at ? new Date(source.last_received_at).toLocaleString() : "Waiting for first event"}</dd></div>
      </dl>
      <Button variant="secondary" size="sm" icon={<ArrowsClockwise size={16} />} disabled={busy} onClick={() => rotate(source)}>Rotate signing secret</Button>
    </article>)}</div>}
    <Modal open={createOpen} title="Connect KpnCompute menu" onClose={() => setCreateOpen(false)} footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button><Button variant="primary" loading={busy} disabled={!name.trim() || !tenantId.trim()} onClick={create}>Connect</Button></>}>
      <Field label="Connection name"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="KpnSolute tenant ID"><Input value={tenantId} onChange={(event) => setTenantId(event.target.value.toLowerCase())} /></Field>
      <p className="scena-help">Scena registers a signed CloudEvents endpoint for this tenant. Menu updates become Connected Content automatically.</p>
    </Modal>
    <Modal open={Boolean(credential)} title="Save this credential now" onClose={() => setCredential(null)} footer={<Button variant="primary" onClick={() => setCredential(null)}>I saved it</Button>}>
      {credential && <div className="scena-credential"><p>This legacy secret cannot be viewed again.</p><Field label="Webhook URL"><Input readOnly value={credential.url} /></Field><Field label="Connection ID"><Input readOnly value={credential.source_id} /></Field><Field label="Bearer secret"><Input readOnly value={credential.secret} /></Field><pre>{JSON.stringify(credential.event_shape, null, 2)}</pre></div>}
    </Modal>
  </div>;
}
