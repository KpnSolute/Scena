import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Images, GridFour, List as ListIcon } from "@phosphor-icons/react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import {
  createAssetUpload, uploadAssetSource, finalizeAssetUpload, getAssetPreview, listAssets, waitForAsset,
  MAX_ASSET_SOURCE_BYTES,
} from "../../services/scena-api/assets";
import type { AssetSummary, AssetStatus } from "../../services/scena-api/assets";
import { isUploadableAsset } from "../../services/scena-api/assets";
import { isScenaApiError } from "../../services/scena-api/errors";
import { SCENA_UI_API_CAPABILITIES } from "../../services/scena-api/capabilities";
import { PageHeader } from "../../components/ui/PageHeader";
import { SearchInput } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Grid, GridCard } from "../../components/ui/Card";
import { IconButton, ButtonGroup } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusIndicator } from "../../components/ui/Badge";
import { UploadDropzone, FileQueue } from "../../components/ui/UploadDropzone";
import type { FileQueueItemDef } from "../../components/ui/UploadDropzone";
import { useToast } from "../../components/ui/Toast";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "ready", label: "Ready" },
  { value: "processing", label: "Processing" },
  { value: "queued", label: "Queued" },
  { value: "failed", label: "Failed" },
  { value: "archived", label: "Archived" },
];

export function AssetsPage() {
  const context = useManagerContext();
  const toast = useToast();
  const [assets, setAssets] = useState<AssetSummary[] | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [queue, setQueue] = useState<FileQueueItemDef[]>([]);
  const queueSeq = useRef(0);

  function load() {
    setError(null);
    const controller = new AbortController();
    listAssets(context.workspace.id, statusFilter ? { status: statusFilter as AssetStatus, signal: controller.signal } : { signal: controller.signal })
      .then(async (res) => {
        setAssets(res.assets);
        const previews = await Promise.all(res.assets.filter((asset) => asset.status === "ready").map(async (asset) => {
          try {
            const preview = await getAssetPreview(asset.id, { signal: controller.signal });
            return [asset.id, preview.signed_url] as const;
          } catch {
            return null;
          }
        }));
        if (!controller.signal.aborted) {
          setPreviewUrls(Object.fromEntries(previews.filter((entry): entry is readonly [string, string] => entry !== null)));
        }
      })
      .catch(setError);
    return () => controller.abort();
  }

  useEffect(() => load(), [context.workspace.id, statusFilter]);

  function updateQueueItem(key: string, patch: Partial<FileQueueItemDef>) {
    setQueue((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function handleFiles(files: File[]) {
    for (const file of files.filter(isUploadableAsset)) {
      const key = `upload-${++queueSeq.current}`;
      setQueue((prev) => [...prev, { key, name: file.name, status: "uploading", statusLabel: "Uploading…" }]);
      uploadOne(key, file).catch(() => {});
    }
  }

  async function uploadOne(key: string, file: File) {
    try {
      const target = await createAssetUpload(context.workspace.id, file);
      await uploadAssetSource(target, file);
      updateQueueItem(key, { status: "processing", statusLabel: "Processing…" });
      await finalizeAssetUpload(target.asset_id);
      const detail = await waitForAsset(target.asset_id, { timeoutMs: 120_000 });
      updateQueueItem(key, { status: "ready", statusLabel: "Ready" });
      toast.show(`${detail.asset.original_filename} is ready`, "success");
      load();
    } catch (err) {
      if (isScenaApiError(err) && err.code === "PROCESSING_TIMEOUT") {
        updateQueueItem(key, { status: "processing", statusLabel: "Still processing in the background" });
        load();
        toast.show(`${file.name} is still processing in the background`, "info");
        return;
      }
      const message = err instanceof Error ? err.message : "Upload failed.";
      updateQueueItem(key, { status: "failed", statusLabel: message });
      toast.show(message, "danger");
    }
  }

  const filtered = assets?.filter((asset) => asset.original_filename.toLowerCase().includes(search.toLowerCase())) ?? [];

  return (
    <div className="scena-page">
      <PageHeader title="Assets" description="Images, PDFs, and PowerPoint files ready to use in a Board." />

      <UploadDropzone
        onFiles={handleFiles}
        accept="image/*,.pdf,.ppt,.pptx"
        hint={`Images, PDF, and PowerPoint up to ${Math.round(MAX_ASSET_SOURCE_BYTES / (1024 * 1024))} MB. The monthly upload count is consumed only after a file finishes uploading — a failed upload doesn't count against your quota.`}
      />
      <FileQueue items={queue} />

      <div className="scena-filter-bar" style={{ marginTop: 32 }}>
        <SearchInput placeholder="Search Assets" value={search} onChange={(event) => setSearch(event.target.value)} style={{ maxWidth: 280 }} />
        <Select
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          style={{ maxWidth: 180 }}
        />
        <div style={{ marginLeft: "auto" }}>
          <ButtonGroup>
            <IconButton icon={<GridFour size={18} />} label="Grid view" active={view === "grid"} onClick={() => setView("grid")} />
            <IconButton icon={<ListIcon size={18} />} label="List view" active={view === "list"} onClick={() => setView("list")} />
          </ButtonGroup>
        </div>
      </div>

      {error ? (
        <ErrorBanner error={error} onRetry={load} />
      ) : !assets ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
          {[1, 2, 3, 4].map((key) => <Skeleton key={key} height={160} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Images size={32} />}
          title={assets.length === 0 ? "No Assets yet" : "No Assets match your filters"}
          description={assets.length === 0 ? "Drag a file above to upload your first Asset." : undefined}
        />
      ) : view === "grid" ? (
        <Grid>
          {filtered.map((asset) => (
            <Link key={asset.id} to={`/app/assets/${asset.id}`} style={{ display: "block" }}>
              <GridCard
                thumb={previewUrls[asset.id] ? <img src={previewUrls[asset.id]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Images size={28} />}
                title={asset.original_filename}
                meta={<StatusIndicator status={asset.status} />}
              />
            </Link>
          ))}
        </Grid>
      ) : (
        <div className="scena-table-wrap">
          <table className="scena-table">
            <caption className="scena-visually-hidden">Assets</caption>
            <thead>
              <tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Uploaded</th></tr>
            </thead>
            <tbody>
              {filtered.map((asset) => (
                <tr key={asset.id}>
                  <td><Link to={`/app/assets/${asset.id}`}>{asset.original_filename}</Link></td>
                  <td style={{ textTransform: "capitalize" }}>{asset.asset_kind}</td>
                  <td><StatusIndicator status={asset.status} /></td>
                  <td>{asset.source_uploaded_at ? new Date(asset.source_uploaded_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!SCENA_UI_API_CAPABILITIES.workers.videoIngest && (
        <p style={{ marginTop: 24, fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)" }}>
          Video, audio, and font uploads aren't supported yet — only images, PDFs, and PowerPoint files.
        </p>
      )}
    </div>
  );
}
