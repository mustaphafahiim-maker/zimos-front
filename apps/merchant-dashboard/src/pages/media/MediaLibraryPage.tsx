import { useRef, useState } from "react";
import { Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { Alert, Button, Spinner } from "@store-builder/ui";
import type { MediaAsset } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useCursorList } from "@/lib/useCursorList";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { ACCEPTED_IMAGE_ACCEPT, compressImageIfNeeded, validateImageFile } from "@/lib/media";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { LoadMore } from "@/components/LoadMore";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
    delete: "Remove",
    deleteTitle: "Remove this image from the library?",
    deleteDesc:
      "The file itself stays on the server, so a product or page already using it keeps working. It just stops being listed here.",
    deleted: "Image removed from the library.",
    size: "{kb} KB",
    sizeMb: "{mb} MB",
    preview: "Uploaded image",
    broken: "This image can't be loaded",
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
    delete: "شيل",
    deleteTitle: "تشيل الصورة دي من المكتبة؟",
    deleteDesc:
      "الملف نفسه هيفضل على السيرفر، يعني أي منتج أو صفحة شغالة بيها هتفضل شغالة. هي بس مش هتتعرض هنا تاني.",
    deleted: "الصورة اتشالت من المكتبة.",
    size: "{kb} كيلوبايت",
    sizeMb: "{mb} ميجابايت",
    preview: "صورة مرفوعة",
    broken: "الصورة دي مش راضية تفتح",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

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

function Thumb({
  asset,
  t,
  onDelete,
}: {
  asset: MediaAsset;
  t: Strings;
  onDelete: () => void;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <li className="group overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-raised">
      <div className="flex aspect-square items-center justify-center bg-paper">
        {broken ? (
          <span className="flex flex-col items-center gap-1 px-2 text-center text-xs text-ink-soft">
            <ImageIcon className="size-5" aria-hidden />
            {t.broken}
          </span>
        ) : (
          <img
            src={displaySrc(asset.url)}
            alt={t.preview}
            loading="lazy"
            className="size-full object-cover"
            onError={() => setBroken(true)}
          />
        )}
      </div>
      <div className="border-t border-line px-2 py-1.5">
        <p className="text-xs text-ink-soft">{formatDateTime(asset.createdAt)}</p>
        <p className="tabular-nums text-xs text-ink-soft">{humanSize(asset.size, t)}</p>
        <div className="mt-1 flex items-center justify-between gap-1">
          <CopyButton value={asset.url} label={t.copyUrl} labelClassName="sr-only" />
          <Button
            size="xs"
            variant="ghost"
            className="text-danger hover:bg-danger-soft"
            onClick={onDelete}
            aria-label={`${t.delete} — ${formatDateTime(asset.createdAt)}`}
          >
            <Trash2 aria-hidden />
            {t.delete}
          </Button>
        </div>
      </div>
    </li>
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

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Spinner className="size-4" /> : <Upload aria-hidden />}
            {uploading ? t.uploading : t.upload}
          </Button>
        }
      />

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

      <DataState loading={list.loading} error={list.error} onRetry={list.reload}>
        {list.items.length === 0 ? (
          <EmptyState
            icon={<ImageIcon />}
            title={t.empty}
            description={t.emptyDesc}
            action={
              <Button disabled={uploading} onClick={() => inputRef.current?.click()}>
                <Upload aria-hidden />
                {t.upload}
              </Button>
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {list.items.map((asset) => (
              <Thumb key={asset.id} asset={asset} t={t} onDelete={() => setRemoving(asset)} />
            ))}
          </ul>
        )}
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>

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
          toast.success(t.deleted);
          setRemoving(null);
        }}
      />
    </div>
  );
}
