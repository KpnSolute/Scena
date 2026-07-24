import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  SquaresFour, Plus, DotsThreeVertical, PencilSimple, CopySimple, Power, Trash,
} from "@phosphor-icons/react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { canManage } from "../../auth/organization-context";
import * as Layouts from "../../domain/layouts";
import * as Locations from "../../domain/locations";
import { ApiError } from "../../shared/errors";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { Button, IconButton } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { Skeleton } from "../../components/ui/Skeleton";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { DropdownMenu } from "../../components/ui/Menu";
import { useToast } from "../../components/ui/Toast";
import { validateLayoutFields } from "./layoutValidation";

export function LayoutsPage() {
  const context = useManagerContext();
  const toast = useToast();
  const manage = canManage(context.role);
  const [locations, setLocations] = useState<Locations.Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [layouts, setLayouts] = useState<Layouts.Layout[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<Layouts.Layout | null>(null);
  const [duplicating, setDuplicating] = useState<Layouts.Layout | null>(null);
  const [deleting, setDeleting] = useState<Layouts.Layout | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  useEffect(() => {
    Locations.listLocations(context.workspace.id).then((rows) => {
      setLocations(rows);
      if (rows.length && !locationId) setLocationId(rows[0].id);
    }).catch(setError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.workspace.id]);

  function load() {
    if (!locationId) return;
    setError(null);
    Layouts.listLayouts(context.workspace.id, locationId).then(setLayouts).catch(setError);
  }
  useEffect(load, [context.workspace.id, locationId]);

  async function toggleActive(layout: Layouts.Layout) {
    setRowBusyId(layout.id);
    try {
      await Layouts.updateLayout(context.workspace.id, layout.id, { is_active: !layout.is_active });
      toast.show(layout.is_active ? "Layout deactivated." : "Layout activated.", "success");
      load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't update Layout.", "danger");
    } finally {
      setRowBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setRowBusyId(deleting.id);
    try {
      await Layouts.deleteLayout(context.workspace.id, deleting.id);
      toast.show("Layout deleted.", "success");
      setDeleting(null);
      load();
    } catch (err) {
      const inUse = err instanceof ApiError && (err.code === "RESOURCE_NOT_FOUND" || err.code === "NOT_FOUND");
      toast.show(
        inUse
          ? `"${deleting.name}" is still in use by a Session, Screen assignment, or Automation and can't be deleted. Deactivate it instead.`
          : err instanceof Error ? err.message : "Couldn't delete Layout.",
        "danger",
      );
    } finally {
      setRowBusyId(null);
    }
  }

  return (
    <div className="scena-page">
      <PageHeader
        title="Layouts"
        description="Arrange Scenes into positioned tiles that Displays render."
        actions={manage ? (
          <Button variant="primary" icon={<Plus size={18} />} onClick={() => setCreateOpen(true)} disabled={!locationId}>
            New layout
          </Button>
        ) : undefined}
      />

      <div className="scena-filter-bar">
        <Select
          aria-label="Location"
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
          options={[{ value: "", label: "Select a location" }, ...locations.map((location) => ({ value: location.id, label: location.name }))]}
          style={{ maxWidth: 240 }}
        />
      </div>

      {!locationId ? (
        <EmptyState icon={<SquaresFour size={32} />} title="Choose a location" description="Select a location above to see its Layouts." />
      ) : error ? (
        <ErrorBanner error={error} onRetry={load} />
      ) : !layouts ? (
        <div style={{ display: "grid", gap: 12 }}><Skeleton height={56} /><Skeleton height={56} /></div>
      ) : layouts.length === 0 ? (
        <EmptyState
          icon={<SquaresFour size={32} />}
          title="No Layouts yet"
          description={manage ? "Create a Layout to position Scenes on this location's Displays." : "Layouts will appear here once created."}
          action={manage ? <Button variant="primary" icon={<Plus size={18} />} onClick={() => setCreateOpen(true)}>New layout</Button> : undefined}
        />
      ) : (
        <div className="scena-table-wrap">
          <table className="scena-table">
            <caption className="scena-visually-hidden">Layouts</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Canvas</th>
                <th scope="col">Background</th>
                <th scope="col">Status</th>
                {manage && <th scope="col" aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {layouts.map((layout) => (
                <tr key={layout.id}>
                  <td>
                    <Link to={`/app/layouts/${layout.id}`} style={{ fontWeight: 600 }}>{layout.name}</Link>
                  </td>
                  <td>{layout.canvas_width} × {layout.canvas_height}</td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span className="scena-layout-swatch" style={{ background: layout.background_color }} aria-hidden="true" />
                      {layout.background_color}
                    </span>
                  </td>
                  <td>
                    <Badge tone={layout.is_active ? "success" : "neutral"} dot>
                      {layout.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  {manage && (
                    <td>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <DropdownMenu
                          trigger={<IconButton icon={<DotsThreeVertical size={18} weight="bold" />} label={`Actions for ${layout.name}`} size="sm" />}
                          items={[
                            { key: "rename", label: "Rename", icon: <PencilSimple size={16} />, onSelect: () => setRenaming(layout) },
                            { key: "duplicate", label: "Duplicate", icon: <CopySimple size={16} />, onSelect: () => setDuplicating(layout) },
                            {
                              key: "toggle",
                              label: layout.is_active ? "Deactivate" : "Activate",
                              icon: <Power size={16} />,
                              disabled: rowBusyId === layout.id,
                              onSelect: () => toggleActive(layout),
                            },
                            { key: "delete", label: "Delete", icon: <Trash size={16} />, danger: true, onSelect: () => setDeleting(layout) },
                          ]}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <CreateLayoutModal
          orgId={context.workspace.id}
          locationId={locationId}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            toast.show("Layout created.", "success");
            load();
          }}
        />
      )}

      {renaming && (
        <RenameLayoutModal
          orgId={context.workspace.id}
          layout={renaming}
          onClose={() => setRenaming(null)}
          onRenamed={() => {
            setRenaming(null);
            toast.show("Layout renamed.", "success");
            load();
          }}
        />
      )}

      {duplicating && (
        <DuplicateLayoutModal
          orgId={context.workspace.id}
          layout={duplicating}
          onClose={() => setDuplicating(null)}
          onDuplicated={() => {
            setDuplicating(null);
            toast.show("Layout duplicated.", "success");
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={deleting ? `Delete "${deleting.name}"?` : "Delete Layout?"}
        description="This can't be undone. If this Layout is still assigned to a Session, Screen, or Automation, deleting will fail — deactivate it instead."
        confirmLabel="Delete"
        danger
        loading={!!deleting && rowBusyId === deleting.id}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function CreateLayoutModal({ orgId, locationId, onClose, onCreated }: {
  orgId: string;
  locationId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [background, setBackground] = useState("#000000");
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const fieldErrors = validateLayoutFields({ name, canvasWidth: width, canvasHeight: height, backgroundColor: background });
  const valid = Object.keys(fieldErrors).length === 0;

  async function create() {
    if (!valid) return;
    setError(null);
    setSubmitting(true);
    try {
      await Layouts.createLayout(orgId, locationId, {
        name: name.trim(),
        canvas_width: width,
        canvas_height: height,
        background_color: background,
      });
      onCreated();
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New layout"
      description="Layouts position Scenes into tiles that a Display renders."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" disabled={!valid} loading={submitting} onClick={create}>Create layout</Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {error ? <ErrorBanner error={error} /> : null}
        <Field label="Name" htmlFor="layout-create-name" error={name.length > 0 ? fieldErrors.name : undefined}>
          <Input id="layout-create-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Front counter" maxLength={120} />
        </Field>
        <div style={{ display: "flex", gap: 16 }}>
          <Field label="Width (px)" htmlFor="layout-create-width" error={fieldErrors.canvasWidth} className="scena-field-flex">
            <Input id="layout-create-width" type="number" min={64} max={7680} value={width} onChange={(event) => setWidth(Number(event.target.value))} />
          </Field>
          <Field label="Height (px)" htmlFor="layout-create-height" error={fieldErrors.canvasHeight} className="scena-field-flex">
            <Input id="layout-create-height" type="number" min={64} max={7680} value={height} onChange={(event) => setHeight(Number(event.target.value))} />
          </Field>
        </div>
        <Field label="Background color" htmlFor="layout-create-bg" hint="Hex color, e.g. #000000." error={fieldErrors.backgroundColor}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="scena-layout-swatch" style={{ background: /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(background) ? background : "transparent" }} aria-hidden="true" />
            <Input id="layout-create-bg" value={background} onChange={(event) => setBackground(event.target.value)} maxLength={9} />
          </div>
        </Field>
      </div>
    </Modal>
  );
}

function RenameLayoutModal({ orgId, layout, onClose, onRenamed }: {
  orgId: string;
  layout: Layouts.Layout;
  onClose: () => void;
  onRenamed: () => void;
}) {
  const [name, setName] = useState(layout.name);
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const trimmed = name.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 120;

  async function save() {
    if (!valid) return;
    setError(null);
    setSubmitting(true);
    try {
      await Layouts.updateLayout(orgId, layout.id, { name: trimmed });
      onRenamed();
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Rename layout"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" disabled={!valid} loading={submitting} onClick={save}>Save</Button>
        </>
      }
    >
      {error ? <ErrorBanner error={error} /> : null}
      <Field label="Name" htmlFor="layout-rename-name" error={name.length > 0 && !valid ? "Name must be 1–120 characters." : undefined}>
        <Input id="layout-rename-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
      </Field>
    </Modal>
  );
}

function DuplicateLayoutModal({ orgId, layout, onClose, onDuplicated }: {
  orgId: string;
  layout: Layouts.Layout;
  onClose: () => void;
  onDuplicated: () => void;
}) {
  const [name, setName] = useState(`${layout.name} copy`.slice(0, 120));
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const trimmed = name.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 120;

  async function duplicate() {
    if (!valid) return;
    setError(null);
    setSubmitting(true);
    try {
      await Layouts.duplicateLayout(orgId, layout.id, trimmed);
      onDuplicated();
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Duplicate layout"
      description={`Creates a copy of "${layout.name}", including its tiles.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" disabled={!valid} loading={submitting} onClick={duplicate}>Duplicate</Button>
        </>
      }
    >
      {error ? <ErrorBanner error={error} /> : null}
      <Field label="New name" htmlFor="layout-duplicate-name" error={name.length > 0 && !valid ? "Name must be 1–120 characters." : undefined}>
        <Input id="layout-duplicate-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
      </Field>
    </Modal>
  );
}
