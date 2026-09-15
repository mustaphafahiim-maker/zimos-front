import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Check, Image as ImageIcon } from "lucide-react";
import { Button, cn } from "@store-builder/ui";
import type { Tree } from "@store-builder/store-renderer";
import { Modal } from "@/components/Modal";
import { fmt } from "@/i18n/LocaleContext";
import type { CatalogData } from "./StoreChrome";
import { useBuilderT } from "./strings";

/**
 * The store's image library inside the builder.
 *
 * BACKEND: media has only POST /workspaces/:id/media (no list endpoint), so the
 * library is assembled from what the frontend can see: uploads made from this
 * device (kept in localStorage), product photos from the catalog, and every
 * image already used in the page drafts.
 */

type Source = "uploads" | "products" | "pages";
export interface LibraryImage {
  url: string;
  sources: Source[];
}

interface MediaLibraryValue {
  images: LibraryImage[];
  remember: (urls: string[]) => void;
}

const Ctx = createContext<MediaLibraryValue | null>(null);
export const useMediaLibrary = () => useContext(Ctx);

const MAX_UPLOADS = 300;
const storageKey = (workspaceId: string) => `zimos.media.${workspaceId}`;
const isImageUrl = (v: unknown): v is string => typeof v === "string" && /^(https?:\/\/|\/uploads\/)/i.test(v.trim());

function readUploads(workspaceId: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(workspaceId)) ?? "[]");
    return Array.isArray(raw) ? raw.filter(isImageUrl) : [];
  } catch {
    return [];
  }
}

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
  const [uploads, setUploads] = useState<string[]>(() => readUploads(workspaceId));

  const remember = useCallback(
    (urls: string[]) => {
      const clean = urls.filter(isImageUrl);
      if (clean.length === 0) return;
      setUploads((prev) => {
        const next = [...clean, ...prev.filter((u) => !clean.includes(u))].slice(0, MAX_UPLOADS);
        try {
          localStorage.setItem(storageKey(workspaceId), JSON.stringify(next));
        } catch {
          /* storage full or unavailable */
        }
        return next;
      });
    },
    [workspaceId]
  );

  const images = useMemo(() => {
    const map = new Map<string, Set<Source>>();
    const add = (url: string, source: Source) => {
      const set = map.get(url) ?? new Set<Source>();
      set.add(source);
      map.set(url, set);
    };
    uploads.forEach((u) => add(u, "uploads"));
    for (const p of catalog.products) for (const m of p.media ?? []) {
      const url = (m as { url?: unknown }).url;
      if (isImageUrl(url)) add(url, "products");
    }
    imagesInTrees(trees).forEach((u) => add(u, "pages"));
    return Array.from(map, ([url, sources]) => ({ url, sources: Array.from(sources) }));
  }, [uploads, catalog.products, trees]);

  const value = useMemo(() => ({ images, remember }), [images, remember]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function LibraryThumb({ url, selected, onToggle, label }: { url: string; selected: boolean; onToggle: () => void; label: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      aria-label={label}
      className={cn(
        "group relative aspect-square cursor-pointer overflow-hidden rounded-lg border-2 bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
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
  );
}

/** Picker dialog. `multiple` returns every selected image; otherwise picking one returns immediately. */
export function MediaLibraryDialog({ open, multiple = false, onClose, onPick }: { open: boolean; multiple?: boolean; onClose: () => void; onPick: (urls: string[]) => void }) {
  const t = useBuilderT();
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

  function close() {
    setSelected([]);
    onClose();
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
      {images.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-soft">{t.mediaEmpty}</p>
      ) : (
        <div className="grid max-h-[55vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {images.map((img) => (
            <LibraryThumb
              key={img.url}
              url={img.url}
              label={t.mediaPick}
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
      )}
    </Modal>
  );
}
