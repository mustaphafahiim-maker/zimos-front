import { useRef, useState } from "react";
import { Image as ImageIcon, Images, Trash2, Upload, X } from "lucide-react";
import { Alert, Button, Label, Spinner } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage } from "@/lib/errors";
import { ACCEPTED_IMAGE_ACCEPT, compressImageIfNeeded, validateImageFile } from "@/lib/media";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { MediaLibraryDialog, useMediaLibrary } from "../builder/mediaLibrary";

const STRINGS = {
  en: {
    prepareFailed: "Could not prepare the selected image.",
    removeImage: "Remove image",
    replace: "Replace",
    upload: "Upload",
    addImages: "Add images",
    clear: "Clear",
    library: "From library",
  },
  ar: {
    prepareFailed: "تعذّر تجهيز الصورة المحددة.",
    removeImage: "إزالة الصورة",
    replace: "استبدال",
    upload: "رفع صورة",
    addImages: "إضافة صور",
    clear: "مسح الكل",
    library: "من المكتبة",
  },
} satisfies Messages;

/**
 * Image picker for a page element's props. Uploads through the same R2 flow the
 * catalog uses (`apiClient.uploadMedia` → POST /workspaces/:id/media) and stores
 * the returned **absolute** `url` in the tree: unlike the dashboard's product
 * images, a page tree is rendered by the public storefront on a different host,
 * where a host-relative path would not resolve.
 *
 * Inside the builder, a store image library is also available (see
 * builder/mediaLibrary.tsx); every upload is added to it.
 */

function useUpload() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const lib = useMediaLibrary();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: File[]): Promise<string[]> {
    if (files.length === 0) return [];

    // Over-limit images are resized in the browser first, so validateImageFile
    // only rejects what could not be brought under the cap.
    setBusy(true);
    const prepared: File[] = [];
    try {
      for (const file of files) prepared.push(await compressImageIfNeeded(file));
    } catch {
      setBusy(false);
      setError(t.prepareFailed);
      return [];
    }

    const rejected: string[] = [];
    const valid: File[] = [];
    for (const file of prepared) {
      const problem = validateImageFile(file);
      if (problem) rejected.push(problem);
      else valid.push(file);
    }
    setError(rejected.length > 0 ? rejected.join(" ") : null);
    if (valid.length === 0) {
      setBusy(false);
      return [];
    }

    const urls: string[] = [];
    try {
      for (const file of valid) {
        const media = await apiClient.uploadMedia(workspaceId, file);
        urls.push(media.url);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
    lib?.remember(urls);
    return urls;
  }

  return { upload, busy, error };
}

function Thumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  const t = useT(STRINGS);
  const [broken, setBroken] = useState(false);
  return (
    <div className="group relative size-20 shrink-0 overflow-hidden rounded-lg border border-line bg-paper">
      {broken ? (
        <div className="flex size-full items-center justify-center text-ink-muted">
          <ImageIcon className="size-5" aria-hidden />
        </div>
      ) : (
        <img src={src} alt="" className="size-full object-cover" onError={() => setBroken(true)} />
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t.removeImage}
        title={t.removeImage}
        className="cursor-pointer absolute end-1 top-1 rounded-full bg-zimos-navy/75 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <X className="size-3" aria-hidden />
      </button>
    </div>
  );
}

/** Single image: one thumbnail plus upload / library buttons. */
export function ImageField({
  label,
  value,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  hint?: string;
  onChange: (url: string) => void;
}) {
  const t = useT(STRINGS);
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, busy, error } = useUpload();
  const lib = useMediaLibrary();
  const [libraryOpen, setLibraryOpen] = useState(false);

  async function pick(list: FileList | null) {
    if (!list || list.length === 0) return;
    const [url] = await upload([list[0]]);
    if (url) onChange(url);
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {value ? (
          <Thumb src={value} onRemove={() => onChange("")} />
        ) : (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-line bg-zimos-ice/40 text-ink-muted">
            <ImageIcon className="size-5" aria-hidden />
          </div>
        )}
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? <Spinner className="size-4" /> : <Upload className="size-4" aria-hidden />}
              {value ? t.replace : t.upload}
            </Button>
            {lib && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setLibraryOpen(true)}>
                <Images className="size-4" aria-hidden />
                {t.library}
              </Button>
            )}
          </div>
          {hint && <p className="text-xs text-ink-soft">{hint}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files);
          e.target.value = "";
        }}
      />
      {error && <Alert variant="danger">{error}</Alert>}
      {lib && <MediaLibraryDialog open={libraryOpen} onClose={() => setLibraryOpen(false)} onPick={([url]) => url && onChange(url)} />}
    </div>
  );
}

/** Multiple images (gallery): a strip of thumbnails plus multi-file upload / library. */
export function ImageListField({
  label,
  value,
  hint,
  onChange,
}: {
  label: string;
  value: string[];
  hint?: string;
  onChange: (urls: string[]) => void;
}) {
  const t = useT(STRINGS);
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, busy, error } = useUpload();
  const lib = useMediaLibrary();
  const [libraryOpen, setLibraryOpen] = useState(false);

  async function add(list: FileList | null) {
    if (!list || list.length === 0) return;
    const urls = await upload(Array.from(list));
    if (urls.length > 0) onChange([...value, ...urls]);
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((src, i) => (
            <Thumb key={`${src}-${i}`} src={src} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Spinner className="size-4" /> : <Upload className="size-4" aria-hidden />}
          {t.addImages}
        </Button>
        {lib && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setLibraryOpen(true)}>
            <Images className="size-4" aria-hidden />
            {t.library}
          </Button>
        )}
        {value.length > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])}>
            <Trash2 className="size-4" aria-hidden />
            {t.clear}
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = "";
        }}
      />
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
      {error && <Alert variant="danger">{error}</Alert>}
      {lib && <MediaLibraryDialog open={libraryOpen} multiple onClose={() => setLibraryOpen(false)} onPick={(urls) => onChange([...value, ...urls])} />}
    </div>
  );
}
