import { useRef, useState, type ReactNode } from "react";
import { IconCopy, IconDelete, IconExternal, IconEye, IconImage, IconImageMissing, IconUpload } from "@/components/icons";
import { Alert, Button, Spinner } from "@store-builder/ui";
import { ImageSizeHint } from "@/components/ImageSizeHint";
import type { MediaAsset } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useCursorList } from "@/lib/useCursorList";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { ACCEPTED_IMAGE_ACCEPT, compressImageIfNeeded, validateImageFile } from "@/lib/media";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState, SkeletonBar } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { LoadMore } from "@/components/LoadMore";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";

const PAGE_LIMIT = 60;

const STRINGS = {
  en: {
    title: "Media library",
    description:
      "Every image you've uploaded to this store, newest first. Product photos and website images all land here.",
    upload: "Upload images",
    uploading: "Uploading…",
    uploaded: "{n} image uploaded.",
    uploadedMany: "{n} images uploaded.",
    empty: "No images yet",
    emptyDesc:
      "Upload an image here, or add one to a product or a website page — they all end up in this library.",
    copyUrl: "Copy image link",
    copied: "Image link copied.",
    copyFailed: "The link couldn't be copied. Open the image and copy it from there.",
    delete: "Remove",
    deleteTitle: "Remove this image from the library?",
    deleteDesc:
      "The file itself stays on the server, so a product or page already using it keeps working. It just stops being listed here.",
    deleted: "Image removed from the library.",
    size: "{kb} KB",
    sizeMb: "{mb} MB",
    preview: "Uploaded image",
    broken: "This image can't be loaded",
    look: "Look at the image uploaded {date}",
    menuLabel: "Actions for this image",
    menuLook: "Quick look",
    menuOpen: "Open in a new tab",
    sheetTitle: "Image",
    factDate: "Uploaded",
    factSize: "Size",
    factType: "Type",
    factLink: "Link",
    loading: "Loading the images…",
  },
  ar: {
    title: "مكتبة الصور",
    description:
      "كل الصور اللي رفعتها للمتجر ده، الأحدث الأول. صور المنتجات وصور الموقع كلها بتنزل هنا.",
    upload: "ارفع صور",
    uploading: "بنرفع…",
    uploaded: "اترفعت {n} صورة.",
    uploadedMany: "اترفعت {n} صورة.",
    empty: "مفيش صور لسه",
    emptyDesc: "ارفع صورة من هنا، أو ضيف واحدة لمنتج أو صفحة في الموقع — كلهم بينزلوا في المكتبة دي.",
    copyUrl: "انسخ لينك الصورة",
    copied: "لينك الصورة اتنسخ.",
    copyFailed: "اللينك ما اتنسخش. افتح الصورة وانسخه من هناك.",
    delete: "شيل",
    deleteTitle: "تشيل الصورة دي من المكتبة؟",
    deleteDesc:
      "الملف نفسه هيفضل على السيرفر، يعني أي منتج أو صفحة شغّالة بيها هتفضل شغّالة. هي بس مش هتتعرض هنا تاني.",
    deleted: "الصورة اتشالت من المكتبة.",
    size: "{kb} كيلو",
    sizeMb: "{mb} ميجا",
    preview: "صورة مرفوعة",
    broken: "الصورة دي مش راضية تفتح",
    look: "شوف الصورة اللي اترفعت {date}",
    menuLabel: "إجراءات الصورة دي",
    menuLook: "بصّة سريعة",
    menuOpen: "افتحها في تاب جديد",
    sheetTitle: "الصورة",
    factDate: "اترفعت",
    factSize: "الحجم",
    factType: "النوع",
    factLink: "اللينك",
    loading: "بنحمّل الصور…",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

// Two columns on a phone, up to five on a wide screen: the same grid for the photos and for their placeholders.
const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5";

const ICON_BUTTON =
  "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[color,background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 pointer-fine:size-9";

function humanSize(bytes: number, t: Strings): string {
  if (bytes >= 1024 * 1024) return fmt(t.sizeMb, { mb: (bytes / (1024 * 1024)).toFixed(1) });
  return fmt(t.size, { kb: Math.max(1, Math.round(bytes / 1024)) });
}

/**
 * The list endpoint returns no host-relative `path` (unlike a product's media
 * entry), so the absolute URL is trimmed to its pathname. That keeps the image
 * same-origin in dev, where the Vite proxy serves `/uploads`.
 */
function displaySrc(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * One image of the library: the photo — a press opens it large, with its
 * facts — and under it its size and the two things done with an image here:
 * copy its link, take it off the list. A right-click or a long press gives the
 * same as a menu.
 */
function Thumb({
  asset,
  t,
  onLook,
  onCopy,
  onDelete,
}: {
  asset: MediaAsset;
  t: Strings;
  onLook: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const date = formatDateTime(asset.createdAt);
  const menu: ContextMenuItem[] = [
    { id: "look", label: t.menuLook, icon: IconEye, onSelect: onLook },
    { id: "copy", label: t.copyUrl, icon: IconCopy, onSelect: onCopy },
    {
      id: "open",
      label: t.menuOpen,
      icon: IconExternal,
      onSelect: () => {
        window.open(asset.url, "_blank", "noopener,noreferrer");
      },
    },
    { id: "delete", label: t.delete, icon: IconDelete, destructive: true, separatorBefore: true, onSelect: onDelete },
  ];

  return (
    <li>
      <ContextMenu items={menu} label={t.menuLabel}>
        <div
          data-slot="media-tile"
          className="zimos-media-tile overflow-hidden rounded-[1.25rem] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line"
        >
          <button
            type="button"
            onClick={onLook}
            aria-label={fmt(t.look, { date })}
            aria-haspopup="dialog"
            title={date}
            className="group relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden bg-paper-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          >
            {broken ? (
              <span className="flex flex-col items-center gap-1.5 px-3 text-center text-xs text-ink-soft">
                <IconImageMissing className="size-7" weight="duotone" aria-hidden />
                {t.broken}
              </span>
            ) : (
              <img
                src={displaySrc(asset.url)}
                alt={t.preview}
                loading="lazy"
                className="size-full object-cover transition-transform duration-[var(--dur-move)] ease-[var(--ease-out)] group-active:scale-[0.97] motion-reduce:transition-none motion-reduce:group-active:scale-100"
                onError={() => setBroken(true)}
              />
            )}
          </button>
          <div className="flex items-center gap-0.5 py-0.5 ps-3 pe-1">
            <p className="min-w-0 flex-1 truncate text-xs tabular-nums text-ink-soft" title={date}>
              <bdi>{humanSize(asset.size, t)}</bdi>
            </p>
            <CopyButton value={asset.url} label={t.copyUrl} iconOnly className="size-11 justify-center rounded-full pointer-fine:size-9" />
            <button type="button" className={ICON_BUTTON} onClick={onDelete} aria-label={`${t.delete} — ${date}`} title={t.delete}>
              <IconDelete className="size-[18px]" aria-hidden />
            </button>
          </div>
        </div>
      </ContextMenu>
    </li>
  );
}

/** The grid while its first page loads: squares where the photos will be. */
function GridSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden className={GRID}>
        {Array.from({ length: 10 }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-[1.25rem] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line">
            <SkeletonBar className="aspect-square h-auto w-full rounded-none" />
            <div className="flex h-12 items-center px-3">
              <SkeletonBar className="h-2.5 w-14" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** One fact of the image in its sheet: a quiet label, then the value. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-2">
      <dt className="shrink-0 text-sm text-ink-soft">{label}</dt>
      <dd className="min-w-0 truncate text-sm font-medium text-ink tabular-nums">{children}</dd>
    </div>
  );
}

export function MediaLibraryPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<MediaAsset | null>(null);
  // The image being looked at. It stays mounted while its sheet closes.
  const [look, setLook] = useState<{ asset: MediaAsset; open: boolean } | null>(null);

  const list = useCursorList<MediaAsset>(
    async (before) => {
      const page = await apiClient.listMedia(workspaceId, {
        limit: PAGE_LIMIT,
        ...(before ? { before } : {}),
      });
      return { items: page.media, nextCursor: page.nextCursor };
    },
    [workspaceId]
  );

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setUploadError(null);

    // Over-limit images are shrunk in the browser first, exactly as the
    // catalog and the website editor do, so the merchant is not sent away to
    // resize a photo by hand.
    const problems: string[] = [];
    const ready: File[] = [];
    for (const file of files) {
      let prepared = file;
      try {
        prepared = await compressImageIfNeeded(file);
      } catch {
        // Undecodable here; let validate + the server have the final say.
      }
      const problem = validateImageFile(prepared);
      if (problem) problems.push(problem);
      else ready.push(prepared);
    }

    let uploaded = 0;
    try {
      for (const file of ready) {
        await apiClient.uploadMedia(workspaceId, file);
        uploaded += 1;
      }
    } catch (err) {
      problems.push(getErrorMessage(err));
    } finally {
      setUploading(false);
    }

    setUploadError(problems.length > 0 ? problems.join(" ") : null);
    if (uploaded > 0) {
      toast.success(fmt(uploaded === 1 ? t.uploaded : t.uploadedMany, { n: uploaded }));
      // The upload response is a single asset without `createdAt`, so the list
      // is re-read rather than patched — that also keeps the cursor honest.
      list.reload();
    }
  }

  function copyLink(asset: MediaAsset) {
    const done = navigator.clipboard?.writeText(asset.url);
    if (!done) {
      toast.error(t.copyFailed);
      return;
    }
    done.then(
      () => toast.success(t.copied),
      () => toast.error(t.copyFailed)
    );
  }

  const pick = () => inputRef.current?.click();
  const closeLook = () => setLook((current) => (current ? { ...current, open: false } : current));
  const shown = look?.asset ?? null;

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        primaryAction={
          <Button disabled={uploading} onClick={pick} className="min-h-11 gap-2 rounded-full px-5">
            {uploading ? <Spinner className="size-4" /> : <IconUpload className="size-4" weight="bold" aria-hidden />}
            {uploading ? t.uploading : t.upload}
          </Button>
        }
      />
      {/* «حتى 10 ميجابايت للصورة» (handoff 400). */}
      <ImageSizeHint className="-mt-1 mb-3" />

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_ACCEPT}
        multiple
        className="hidden"
        aria-label={t.upload}
        onChange={(e) => {
          void uploadFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {uploadError && (
        <Alert variant="danger" className="mb-4">
          {uploadError}
        </Alert>
      )}

      <DataState loading={list.loading} error={list.error} onRetry={list.reload} skeleton={<GridSkeleton label={t.loading} />}>
        {list.items.length === 0 ? (
          <EmptyState
            icon={<IconImage weight="duotone" aria-hidden />}
            title={t.empty}
            description={t.emptyDesc}
            action={
              <Button disabled={uploading} onClick={pick} className="min-h-11 gap-2 rounded-full px-5">
                <IconUpload className="size-4" weight="bold" aria-hidden />
                {t.upload}
              </Button>
            }
          />
        ) : (
          <ul className={GRID}>
            {list.items.map((asset) => (
              <Thumb
                key={asset.id}
                asset={asset}
                t={t}
                onLook={() => setLook({ asset, open: true })}
                onCopy={() => copyLink(asset)}
                onDelete={() => setRemoving(asset)}
              />
            ))}
          </ul>
        )}
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>

      {shown && (
        <Sheet
          open={Boolean(look?.open)}
          onOpenChange={(open) => {
            if (!open) closeLook();
          }}
          title={t.sheetTitle}
          description={formatDateTime(shown.createdAt)}
          side="auto-end"
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 gap-2 rounded-full px-5 text-danger"
                onClick={() => {
                  closeLook();
                  setRemoving(shown);
                }}
              >
                <IconDelete className="size-4" aria-hidden />
                {t.delete}
              </Button>
              <Button asChild className="min-h-11 gap-2 rounded-full px-5">
                <a href={shown.url} target="_blank" rel="noreferrer">
                  <IconExternal className="size-4" aria-hidden />
                  {t.menuOpen}
                </a>
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="zimos-media-stage flex items-center justify-center overflow-hidden rounded-[1.25rem] bg-paper-sunken ring-1 ring-line">
              <img src={displaySrc(shown.url)} alt="" className="max-h-[50dvh] w-full object-contain" />
            </div>
            <dl className="divide-y divide-line">
              <Fact label={t.factDate}>{formatDateTime(shown.createdAt)}</Fact>
              <Fact label={t.factSize}>
                <bdi>{humanSize(shown.size, t)}</bdi>
              </Fact>
              <Fact label={t.factType}>
                <bdi dir="ltr">{shown.mimeType}</bdi>
              </Fact>
              <div className="flex min-h-11 items-center justify-between gap-3 py-2">
                <dt className="shrink-0 text-sm text-ink-soft">{t.factLink}</dt>
                <dd className="flex min-w-0 items-center gap-1">
                  <bdi dir="ltr" className="min-w-0 truncate text-xs text-ink-soft">
                    {shown.url}
                  </bdi>
                  <CopyButton value={shown.url} label={t.copyUrl} iconOnly className="size-11 shrink-0 justify-center rounded-full" />
                </dd>
              </div>
            </dl>
          </div>
        </Sheet>
      )}

      <ConfirmDialog
        open={removing !== null}
        title={t.deleteTitle}
        description={t.deleteDesc}
        confirmLabel={t.delete}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          const id = removing.id;
          try {
            await apiClient.deleteMedia(workspaceId, id);
          } catch (err) {
            throw new Error(getErrorMessage(err));
          }
          list.setItems((prev) => prev.filter((asset) => asset.id !== id));
          setLook((current) => (current?.asset.id === id ? null : current));
          toast.success(t.deleted);
          setRemoving(null);
        }}
      />
    </div>
  );
}
