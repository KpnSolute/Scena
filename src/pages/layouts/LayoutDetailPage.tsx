import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, PencilSimple, Plus, Trash, Eye, EyeSlash, CaretUp, CaretDown, FilmSlate, SquaresFour,
} from "@phosphor-icons/react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { canManage } from "../../auth/organization-context";
import * as Layouts from "../../domain/layouts";
import * as Scenes from "../../domain/scenes";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button, IconButton } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { Skeleton } from "../../components/ui/Skeleton";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Modal } from "../../components/ui/Modal";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";
import { cx } from "../../components/ui/cx";
import { validateLayoutFields, validateTileFields } from "./layoutValidation";

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

function sortTiles(tiles: Layouts.LayoutTile[]): Layouts.LayoutTile[] {
  return [...tiles].sort((a, b) => a.z_index - b.z_index || a.created_at.localeCompare(b.created_at));
}

export function LayoutDetailPage() {
  const { layoutId } = useParams<{ layoutId: string }>();
  const context = useManagerContext();
  const navigate = useNavigate();
  const toast = useToast();
  const manage = canManage(context.role);

  const [layout, setLayout] = useState<Layouts.RenderableLayout | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [scenes, setScenes] = useState<Scenes.Scene[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [tileDraft, setTileDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [tileBusyId, setTileBusyId] = useState<string | null>(null);
  const [tileSaving, setTileSaving] = useState(false);
  const [removingTile, setRemovingTile] = useState<Layouts.LayoutTile | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [addTileOpen, setAddTileOpen] = useState(false);

  function load() {
    if (!layoutId) return;
    setError(null);
    setLoaded(false);
    Layouts.getRenderableLayout(context.workspace.id, layoutId)
      .then((loadedLayout) => {
        setLayout(loadedLayout);
        setLoaded(true);
        if (loadedLayout) return Scenes.listScenes(context.workspace.id, loadedLayout.location_id).then(setScenes);
        return undefined;
      })
      .catch((err) => {
        setError(err);
        setLoaded(true);
      });
  }
  useEffect(load, [context.workspace.id, layoutId]);

  const selectedTile = layout?.tiles.find((t) => t.id === selectedTileId) ?? null;

  useEffect(() => {
    if (selectedTile) {
      setTileDraft({ x: selectedTile.x_percent, y: selectedTile.y_percent, w: selectedTile.width_percent, h: selectedTile.height_percent });
    } else {
      setTileDraft(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTile?.id]);

  const tileErrors = tileDraft
    ? validateTileFields({ xPercent: tileDraft.x, yPercent: tileDraft.y, widthPercent: tileDraft.w, heightPercent: tileDraft.h })
    : {};
  const tileValid = Object.keys(tileErrors).length === 0;
  const tileDirty = !!(selectedTile && tileDraft && (
    tileDraft.x !== selectedTile.x_percent
    || tileDraft.y !== selectedTile.y_percent
    || tileDraft.w !== selectedTile.width_percent
    || tileDraft.h !== selectedTile.height_percent
  ));

  const sortedTiles = layout ? sortTiles(layout.tiles) : [];
  const tileIndex = selectedTile ? sortedTiles.findIndex((t) => t.id === selectedTile.id) : -1;
  const canMoveUp = tileIndex >= 0 && tileIndex < sortedTiles.length - 1;
  const canMoveDown = tileIndex > 0;

  function sceneName(sceneId: string): string {
    return scenes?.find((s) => s.id === sceneId)?.name ?? "Unknown Scene";
  }

  async function saveTileGeometry() {
    if (!selectedTile || !tileDraft || !tileValid) return;
    setTileSaving(true);
    try {
      const updated = await Layouts.updateTile(context.workspace.id, selectedTile.id, {
        x_percent: tileDraft.x, y_percent: tileDraft.y, width_percent: tileDraft.w, height_percent: tileDraft.h,
      });
      setLayout((prev) => prev ? { ...prev, tiles: prev.tiles.map((t) => (t.id === updated.id ? updated : t)) } : prev);
      toast.show("Tile updated.", "success");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't update tile.", "danger");
    } finally {
      setTileSaving(false);
    }
  }

  async function toggleTileVisibility(tile: Layouts.LayoutTile) {
    setTileBusyId(tile.id);
    try {
      const updated = await Layouts.updateTile(context.workspace.id, tile.id, { is_visible: !tile.is_visible });
      setLayout((prev) => prev ? { ...prev, tiles: prev.tiles.map((t) => (t.id === updated.id ? updated : t)) } : prev);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't update tile.", "danger");
    } finally {
      setTileBusyId(null);
    }
  }

  async function moveLayer(tile: Layouts.LayoutTile, direction: "up" | "down") {
    if (!layout) return;
    const sorted = sortTiles(layout.tiles);
    const idx = sorted.findIndex((t) => t.id === tile.id);
    const swapIdx = direction === "up" ? idx + 1 : idx - 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    setTileBusyId(tile.id);
    try {
      await Layouts.reorderTileLayers(context.workspace.id, [{ id: a.id, z_index: b.z_index }, { id: b.id, z_index: a.z_index }]);
      setLayout((prev) => prev ? {
        ...prev,
        tiles: prev.tiles.map((t) => {
          if (t.id === a.id) return { ...t, z_index: b.z_index };
          if (t.id === b.id) return { ...t, z_index: a.z_index };
          return t;
        }),
      } : prev);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't reorder tiles.", "danger");
    } finally {
      setTileBusyId(null);
    }
  }

  async function confirmRemoveTile() {
    if (!removingTile) return;
    setTileBusyId(removingTile.id);
    try {
      await Layouts.removeTile(context.workspace.id, removingTile.id);
      setLayout((prev) => prev ? { ...prev, tiles: prev.tiles.filter((t) => t.id !== removingTile.id) } : prev);
      if (selectedTileId === removingTile.id) setSelectedTileId(null);
      toast.show("Tile removed.", "success");
      setRemovingTile(null);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't remove tile.", "danger");
    } finally {
      setTileBusyId(null);
    }
  }

  if (error) {
    return (
      <div className="scena-page">
        <ErrorBanner error={error} onRetry={load} />
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="scena-page">
        <Skeleton height={320} />
      </div>
    );
  }

  if (!layoutId || !layout) {
    return (
      <div className="scena-page">
        <EmptyState
          icon={<SquaresFour size={32} />}
          title="Layout not found"
          description="This Layout doesn't exist in this Workspace, or it may have been removed."
          action={<Button variant="primary" size="sm" onClick={() => navigate("/app/layouts")}>Back to Layouts</Button>}
        />
      </div>
    );
  }

  return (
    <div className="scena-page">
      <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigate("/app/layouts")}>
        Back to Layouts
      </Button>

      <PageHeader
        title={layout.name}
        description={`${layout.canvas_width} × ${layout.canvas_height}`}
        actions={manage ? (
          <Button variant="secondary" icon={<PencilSimple size={18} />} onClick={() => setEditOpen(true)}>
            Edit layout
          </Button>
        ) : undefined}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Badge tone={layout.is_active ? "success" : "neutral"} dot>{layout.is_active ? "Active" : "Inactive"}</Badge>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--scena-text-sm)", color: "var(--scena-text-secondary)" }}>
          <span className="scena-layout-swatch" style={{ background: layout.background_color }} aria-hidden="true" />
          {layout.background_color}
        </span>
      </div>

      <div className="scena-layout-detail-grid">
        <div>
          <div className="scena-layout-canvas-wrap">
            <div
              className="scena-layout-canvas"
              style={{ aspectRatio: `${layout.canvas_width} / ${layout.canvas_height}`, background: layout.background_color }}
            >
              {layout.tiles.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  className={cx(
                    "scena-layout-tile",
                    selectedTileId === tile.id && "scena-layout-tile--selected",
                    !tile.is_visible && "scena-layout-tile--hidden",
                  )}
                  style={{
                    left: `${tile.x_percent}%`,
                    top: `${tile.y_percent}%`,
                    width: `${tile.width_percent}%`,
                    height: `${tile.height_percent}%`,
                    zIndex: tile.z_index,
                  }}
                  aria-pressed={selectedTileId === tile.id}
                  onClick={() => setSelectedTileId(tile.id)}
                >
                  <span className="scena-layout-tile__label">{sceneName(tile.scene_id)}</span>
                </button>
              ))}
            </div>
          </div>

          {manage && (
            scenes === null ? null : scenes.length === 0 ? (
              <div style={{ marginTop: 20 }}>
                <EmptyState
                  icon={<FilmSlate size={28} />}
                  title="No Scenes available"
                  description="Tiles need a Scene to display, and this Location has no Scenes yet. There is no Scene-creation flow in this app yet — a Scene must exist before a tile can be added here."
                />
              </div>
            ) : (
              <div style={{ marginTop: 16 }}>
                <Button variant="secondary" icon={<Plus size={16} />} onClick={() => setAddTileOpen(true)}>Add tile</Button>
              </div>
            )
          )}

          <div className="scena-layout-tile-list">
            {sortTiles(layout.tiles).slice().reverse().map((tile) => (
              <button
                key={tile.id}
                type="button"
                className="scena-layout-tile-list__item"
                data-selected={selectedTileId === tile.id}
                onClick={() => setSelectedTileId(tile.id)}
              >
                <div className="scena-layout-tile-list__meta">
                  <div className="scena-layout-tile-list__name">{sceneName(tile.scene_id)}</div>
                  <div className="scena-layout-tile-list__sub">
                    z {tile.z_index} · {tile.width_percent}% × {tile.height_percent}% at ({tile.x_percent}%, {tile.y_percent}%)
                  </div>
                </div>
                <Badge tone={tile.is_visible ? "success" : "neutral"}>{tile.is_visible ? "Visible" : "Hidden"}</Badge>
              </button>
            ))}
            {layout.tiles.length === 0 && (
              <p style={{ color: "var(--scena-text-muted)", fontSize: "var(--scena-text-sm)" }}>No tiles on this Layout yet.</p>
            )}
          </div>
        </div>

        <Card>
          {!selectedTile ? (
            <p style={{ color: "var(--scena-text-muted)", fontSize: "var(--scena-text-sm)" }}>Select a tile to edit it.</p>
          ) : (
            <div className="scena-layout-tile-editor">
              <div>
                <div style={{ fontSize: "var(--scena-text-xs)", textTransform: "uppercase", color: "var(--scena-text-muted)", marginBottom: 4 }}>Scene</div>
                <div style={{ fontWeight: 600 }}>{sceneName(selectedTile.scene_id)}</div>
              </div>

              <div className="scena-layout-tile-editor__grid">
                <Field label="X %" htmlFor="tile-x" error={tileErrors.xPercent}>
                  <Input id="tile-x" type="number" min={0} max={100} step={0.1} value={tileDraft?.x ?? 0}
                    onChange={(event) => setTileDraft((prev) => prev && { ...prev, x: Number(event.target.value) })} />
                </Field>
                <Field label="Y %" htmlFor="tile-y" error={tileErrors.yPercent}>
                  <Input id="tile-y" type="number" min={0} max={100} step={0.1} value={tileDraft?.y ?? 0}
                    onChange={(event) => setTileDraft((prev) => prev && { ...prev, y: Number(event.target.value) })} />
                </Field>
                <Field label="Width %" htmlFor="tile-w" error={tileErrors.widthPercent}>
                  <Input id="tile-w" type="number" min={0} max={100} step={0.1} value={tileDraft?.w ?? 0}
                    onChange={(event) => setTileDraft((prev) => prev && { ...prev, w: Number(event.target.value) })} />
                </Field>
                <Field label="Height %" htmlFor="tile-h" error={tileErrors.heightPercent}>
                  <Input id="tile-h" type="number" min={0} max={100} step={0.1} value={tileDraft?.h ?? 0}
                    onChange={(event) => setTileDraft((prev) => prev && { ...prev, h: Number(event.target.value) })} />
                </Field>
              </div>

              {manage && (
                <Button variant="primary" size="sm" disabled={!tileDirty || !tileValid} loading={tileSaving} onClick={saveTileGeometry}>
                  Save position
                </Button>
              )}

              <div className="scena-layout-tile-editor__zorder">
                <span style={{ fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)" }}>Layer order</span>
                <IconButton
                  icon={<CaretUp size={16} />}
                  label="Move tile up a layer"
                  size="sm"
                  disabled={!manage || !canMoveUp || tileBusyId === selectedTile.id}
                  onClick={() => moveLayer(selectedTile, "up")}
                />
                <IconButton
                  icon={<CaretDown size={16} />}
                  label="Move tile down a layer"
                  size="sm"
                  disabled={!manage || !canMoveDown || tileBusyId === selectedTile.id}
                  onClick={() => moveLayer(selectedTile, "down")}
                />
              </div>

              {manage && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={selectedTile.is_visible ? <EyeSlash size={16} /> : <Eye size={16} />}
                  loading={tileBusyId === selectedTile.id}
                  onClick={() => toggleTileVisibility(selectedTile)}
                >
                  {selectedTile.is_visible ? "Hide tile" : "Show tile"}
                </Button>
              )}

              {manage && (
                <Button variant="danger" size="sm" icon={<Trash size={16} />} onClick={() => setRemovingTile(selectedTile)}>
                  Remove tile
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>

      {editOpen && (
        <EditLayoutModal
          orgId={context.workspace.id}
          layout={layout}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            toast.show("Layout updated.", "success");
            load();
          }}
        />
      )}

      {addTileOpen && scenes && scenes.length > 0 && (
        <AddTileModal
          orgId={context.workspace.id}
          locationId={layout.location_id}
          layoutId={layout.id}
          scenes={scenes}
          existingTiles={layout.tiles}
          onClose={() => setAddTileOpen(false)}
          onAdded={() => {
            setAddTileOpen(false);
            toast.show("Tile added.", "success");
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={!!removingTile}
        title="Remove tile?"
        description={removingTile ? `"${sceneName(removingTile.scene_id)}" will be removed from this Layout.` : undefined}
        confirmLabel="Remove"
        danger
        loading={!!removingTile && tileBusyId === removingTile.id}
        onConfirm={confirmRemoveTile}
        onCancel={() => setRemovingTile(null)}
      />
    </div>
  );
}

function EditLayoutModal({ orgId, layout, onClose, onSaved }: {
  orgId: string;
  layout: Layouts.Layout;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(layout.name);
  const [width, setWidth] = useState(layout.canvas_width);
  const [height, setHeight] = useState(layout.canvas_height);
  const [background, setBackground] = useState(layout.background_color);
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const fieldErrors = validateLayoutFields({ name, canvasWidth: width, canvasHeight: height, backgroundColor: background });
  const valid = Object.keys(fieldErrors).length === 0;

  async function save() {
    if (!valid) return;
    setError(null);
    setSubmitting(true);
    try {
      await Layouts.updateLayout(orgId, layout.id, {
        name: name.trim(), canvas_width: width, canvas_height: height, background_color: background,
      });
      onSaved();
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit layout"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" disabled={!valid} loading={submitting} onClick={save}>Save</Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {error ? <ErrorBanner error={error} /> : null}
        <Field label="Name" htmlFor="layout-edit-name" error={name.length > 0 ? fieldErrors.name : undefined}>
          <Input id="layout-edit-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
        </Field>
        <div style={{ display: "flex", gap: 16 }}>
          <Field label="Width (px)" htmlFor="layout-edit-width" error={fieldErrors.canvasWidth} className="scena-field-flex">
            <Input id="layout-edit-width" type="number" min={64} max={7680} value={width} onChange={(event) => setWidth(Number(event.target.value))} />
          </Field>
          <Field label="Height (px)" htmlFor="layout-edit-height" error={fieldErrors.canvasHeight} className="scena-field-flex">
            <Input id="layout-edit-height" type="number" min={64} max={7680} value={height} onChange={(event) => setHeight(Number(event.target.value))} />
          </Field>
        </div>
        <Field label="Background color" htmlFor="layout-edit-bg" hint="Hex color, e.g. #000000." error={fieldErrors.backgroundColor}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="scena-layout-swatch" style={{ background: HEX_COLOR_RE.test(background) ? background : "transparent" }} aria-hidden="true" />
            <Input id="layout-edit-bg" value={background} onChange={(event) => setBackground(event.target.value)} maxLength={9} />
          </div>
        </Field>
      </div>
    </Modal>
  );
}

function AddTileModal({ orgId, locationId, layoutId, scenes, existingTiles, onClose, onAdded }: {
  orgId: string;
  locationId: string;
  layoutId: string;
  scenes: Scenes.Scene[];
  existingTiles: Layouts.LayoutTile[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [sceneId, setSceneId] = useState(scenes[0]?.id ?? "");
  const [x, setX] = useState(10);
  const [y, setY] = useState(10);
  const [width, setWidth] = useState(30);
  const [height, setHeight] = useState(30);
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const tileErrors = validateTileFields({ xPercent: x, yPercent: y, widthPercent: width, heightPercent: height });
  const valid = Object.keys(tileErrors).length === 0 && !!sceneId;
  const nextZ = existingTiles.length === 0 ? 0 : Math.max(...existingTiles.map((t) => t.z_index)) + 1;

  async function create() {
    if (!valid) return;
    setError(null);
    setSubmitting(true);
    try {
      await Layouts.addTile(orgId, locationId, layoutId, {
        scene_id: sceneId, x_percent: x, y_percent: y, width_percent: width, height_percent: height, z_index: nextZ,
      });
      onAdded();
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add tile"
      description="Position a Scene on this Layout's canvas, in percent of the canvas size."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" disabled={!valid} loading={submitting} onClick={create}>Add tile</Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {error ? <ErrorBanner error={error} /> : null}
        <Field label="Scene" htmlFor="tile-add-scene">
          <Select
            id="tile-add-scene"
            value={sceneId}
            onChange={(event) => setSceneId(event.target.value)}
            options={scenes.map((scene) => ({ value: scene.id, label: scene.name }))}
          />
        </Field>
        <div className="scena-layout-tile-editor__grid">
          <Field label="X %" htmlFor="tile-add-x" error={tileErrors.xPercent}>
            <Input id="tile-add-x" type="number" min={0} max={100} step={0.1} value={x} onChange={(event) => setX(Number(event.target.value))} />
          </Field>
          <Field label="Y %" htmlFor="tile-add-y" error={tileErrors.yPercent}>
            <Input id="tile-add-y" type="number" min={0} max={100} step={0.1} value={y} onChange={(event) => setY(Number(event.target.value))} />
          </Field>
          <Field label="Width %" htmlFor="tile-add-w" error={tileErrors.widthPercent}>
            <Input id="tile-add-w" type="number" min={0} max={100} step={0.1} value={width} onChange={(event) => setWidth(Number(event.target.value))} />
          </Field>
          <Field label="Height %" htmlFor="tile-add-h" error={tileErrors.heightPercent}>
            <Input id="tile-add-h" type="number" min={0} max={100} step={0.1} value={height} onChange={(event) => setHeight(Number(event.target.value))} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
