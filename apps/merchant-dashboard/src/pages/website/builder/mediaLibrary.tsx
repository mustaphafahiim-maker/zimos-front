import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Image as ImageIcon, Trash2 } from "lucide-react";
import type { MediaItem } from "@store-builder/api-client";
import { Button, cn } from "@store-builder/ui";
import type { Tree } from "@store-builder/store-renderer";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { fmt } from "@/i18n/LocaleContext";
import type { CatalogData } from "./StoreChrome";
import { useBuilderT } from "./strings";

/**
 * The store's image library inside the builder. Sources: the workspace's
 * uploaded media (GET /workspaces/:id/media, paged by cursor), product photos
 * from the catalog, and every image already used in the page drafts.
 */

type Source = "uploads" | "products" | "pages";
export interface LibraryImage {
  url: string;
  sources: Source[];
  /** Server media id when the image is one of the workspace uploads (deletable). */
  mediaId?: string;
}

interface MediaLibraryValue {
  images: LibraryImage[];
  /** Called after an upload: re-fetches the server list so new images show up. */
  remember: (urls: string[]) => void;
  refresh: () => void;
  loadMore: () => void;
  remove: (mediaId: string) => Promise<void>;
  hasMore: boolean;
  loading: boolean;
  error: unknown;
}

const Ctx = createContext<MediaLibraryValue | null>(null);
export const useMediaLibrary = () => useContext(Ctx);

const PAGE_SIZE = 60;
const isImageUrl = (v: unknown): v is string => typeof v === "string" && /^(https?:\/\/|\/uploads\/)/i.test(v.trim());

/** Every image URL referenced by a page tree (image src, video poster, gallery images, section backgrounds). */
export function imagesInTrees(trees: Record<string, Tree>): string[] {
  const out: string[] = [];
  const walk = (node: unknown, key = "") => {
    if (Array.isArray(node)) {
      for (const item of node) {
        if (key === "images" && isImageUrl(item)) out.push(item);
        else walk(item);
      }
    } else if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) walk(v, k);
    } else if ((key === "src" || key === "poster" || key === "backgroundImage") && isImageUrl(node)) {
      out.push(node);
    }
  };
  walk(Object.values(trees));
  return out;
}

export function MediaLibraryProvider({ workspaceId, trees, catalog, children }: { workspaceId: string; trees: Record<string, Tree>; catalog: CatalogData; children: ReactNode }) {
  const [uploads, setUploads] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const callId = useRef(0);

  const fetchPage = useCallback(
    async (before: string | null) => {
      if (!workspaceId) return;
      const id = ++callId.current;
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.listMedia(workspaceId, { limit: PAGE_SIZE, before: before ?? undefined });
        if (id !== callId.current) return;
        const images = res.media.filter((m) => isImageUrl(m.url) && m.mimeType.startsWith("image/"));
        setUploads((prev) => (before ? [...prev, ...images.filter((m) => !prev.some((p) => p.id === m.id))] : images));
        setCursor(res.nextCursor);
      } catch (err) {
        if (id === callId.current) setError(err);
      } finally {
        if (id === callId.current) setLoading(false);
      }
    },
    [workspaceId]
  );

  const refresh = useCallback(() => void fetchPage(null), [fetchPage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const remember = useCallback((urls: string[]) => {
    if (urls.some(isImageUrl)) refresh();
  }, [refresh]);

  const loadMore = useCallback(() => {
    if (cursor && !loading) void fetchPage(cursor);
  }, [cursor, loading, fetchPage]);

  const remove = useCallback(
    async (mediaId: string) => {
      await apiClient.deleteMedia(workspaceId, mediaId);
      setUploads((prev) => prev.filter((m) => m.id !== mediaId));
    },
    [workspaceId]
  );

  const images = useMemo(() => {
    const map = new Map<string, { sources: Set<Source>; mediaId?: string }>();
    const add = (url: string, source: Source, mediaId?: string) => {
      const entry = map.get(url) ?? { sources: new Set<Source>() };
      entry.sources.add(source);
      if (mediaId) entry.mediaId = mediaId;
      map.set(url, entry);
    };
    uploads.forEach((m) => add(m.url, "uploads", m.id));
    for (const p of catalog.products) for (const m of p.media ?? []) {
      const url = (m as { url?: unknown }).url;
      if (isImageUrl(url)) add(url, "products");
    }
    imagesInTrees(trees).forEach((u) => add(u, "pages"));
    return Array.from(map, ([url, e]) => ({ url, sources: Array.from(e.sources), mediaId: e.mediaId }));
  }, [uploads, catalog.products, trees]);

  const value = useMemo(
    () => ({ images, remember, refresh, loadMore, remove, hasMore: cursor !== null, loading, error }),
    [images, remember, refresh, loadMore, remove, cursor, loading, error]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function LibraryThumb({
  url,
  selected,
  onToggle,
  label,
  onDelete,
  deleteLabel,
}: {
  url: string;
  selected: boolean;
  onToggle: () => void;
  label: string;
  onDelete?: () => void;
  deleteLabel: string;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="group relative aspect-square">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        aria-label={label}
        className={cn(
          "relative size-full cursor-pointer overflow-hidden rounded-lg border-2 bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          selected ? "border-primary" : "border-transparent hover:border-line"
        )}
      >
        {broken ? (
          <span className="flex size-full items-center justify-center text-ink-muted">
            <ImageIcon className="size-5" aria-hidden />
          </span>
        ) : (
          <img src={url} alt="" loading="lazy" className="size-full object-cover" onError={() => setBroken(true)} />
        )}
        {selected && (
          <span className="absolute end-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-white shadow">
            <Check className="size-3.5" aria-hidden />
          </span>
        )}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={deleteLabel}
          title={deleteLabel}
          className="absolute bottom-1.5 start-1.5 flex size-7 cursor-pointer items-center justify-center rounded-md border border-line bg-paper-raised text-danger opacity-0 shadow transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Picker dialog. `multiple` returns every selected image; otherwise picking one returns immediately. */
export function MediaLibraryDialog({ open, multiple = false, onClose, onPick }: { open: boolean; multiple?: boolean; onClose: () => void; onPick: (urls: string[]) => void }) {
  const t = useBuilderT();
  const toast = useToast();
  const lib = useMediaLibrary();
  const [filter, setFilter] = useState<Source | "all">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const images = (lib?.images ?? []).filter((i) => filter === "all" || i.sources.includes(filter));
  const tabs: Array<{ id: Source | "all"; label: string }> = [
    { id: "all", label: t.mediaAll },
    { id: "uploads", label: t.mediaUploads },
    { id: "products", label: t.mediaProducts },
    { id: "pages", label: t.mediaPages },
  ];

  const refresh = lib?.refresh;
  useEffect(() => {
    if (open) refresh?.();
  }, [open, refresh]);

  function close() {
    setSelected([]);
    onClose();
  }

  async function handleDelete(img: LibraryImage) {
    if (!lib || !img.mediaId) return;
    if (!window.confirm(t.mediaDeleteConfirm)) return;
    try {
      await lib.remove(img.mediaId);
      setSelected((prev) => prev.filter((u) => u !== img.url));
      toast.success(t.mediaDeleted);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={t.mediaLibrary}
      description={t.mediaNote}
      closeLabel={t.close}
      footer={
        multiple ? (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              {t.cancel}
            </Button>
            <Button
              type="button"
              disabled={selected.length === 0}
              onClick={() => {
                onPick(selected);
                close();
              }}
            >
              {fmt(t.mediaPickMany, { n: selected.length })}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div role="tablist" className="mb-3 flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            onClick={() => setFilter(tab.id)}
            className={cn("cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold", filter === tab.id ? "border-primary bg-primary text-white" : "border-line text-ink-soft hover:border-primary hover:text-primary")}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {lib?.error ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
          <span>{t.mediaLoadFailed}</span>
          <Button type="button" size="xs" variant="outline" onClick={() => lib.refresh()}>
            {t.mediaRetry}
          </Button>
        </div>
      ) : null}
      {images.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-soft">{t.mediaEmpty}</p>
      ) : (
        <div className="max-h-[55vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((img) => (
              <LibraryThumb
                key={img.url}
                url={img.url}
                label={t.mediaPick}
                deleteLabel={t.mediaDelete}
                onDelete={img.mediaId ? () => void handleDelete(img) : undefined}
                selected={selected.includes(img.url)}
                onToggle={() => {
                  if (!multiple) {
                    onPick([img.url]);
                    close();
                    return;
                  }
                  setSelected((prev) => (prev.includes(img.url) ? prev.filter((u) => u !== img.url) : [...prev, img.url]));
                }}
              />
            ))}
          </div>
          {lib?.hasMore && (filter === "all" || filter === "uploads") && (
            <div className="mt-3 flex justify-center">
              <Button type="button" variant="outline" size="sm" disabled={lib.loading} onClick={() => lib.loadMore()}>
                {t.mediaLoadMore}
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
