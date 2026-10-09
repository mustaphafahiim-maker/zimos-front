import { useRef, useState } from "react";
import { IconClose, IconUpload } from "@/components/icons";
import { Button, Input, Spinner } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage } from "@/lib/errors";
import { ACCEPTED_IMAGE_ACCEPT, compressImageIfNeeded, validateImageFile } from "@/lib/media";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { upload: "Upload", remove: "Remove image", placeholder: "Image link, or upload one" },
  ar: { upload: "ارفع", remove: "شيل الصورة", placeholder: "لينك الصورة، أو ارفع صورة" },
} satisfies Messages;

/**
 * One picture as an absolute URL: paste a link or upload through the media
 * library. The storefront renders it from another host, so the stored value
 * is always the absolute `url` the upload returns.
 */
export function ImageUrlInput({
  id,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const prepared = await compressImageIfNeeded(file);
      const problem = validateImageFile(prepared);
      if (problem) {
        setError(problem);
        return;
      }
      const media = await apiClient.uploadMedia(workspaceId, prepared);
      onChange(media.url);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {value ? (
          // A fixed box, so the row does not move when the picture arrives.
          <img
            src={value}
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-[0.625rem] bg-paper-sunken object-cover ring-1 ring-line"
          />
        ) : null}
        <Input
          id={id}
          dir="ltr"
          value={value}
          disabled={disabled || busy}
          placeholder={t.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1"
        />
        <input
          ref={input}
          type="file"
          accept={ACCEPTED_IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="min-h-10 shrink-0 pointer-coarse:min-h-11"
          disabled={disabled || busy}
          aria-busy={busy || undefined}
          onClick={() => input.current?.click()}
        >
          {busy ? <Spinner className="size-4" /> : <IconUpload className="size-4" aria-hidden />}
          {t.upload}
        </Button>
        {value && (
          <button
            type="button"
            aria-label={t.remove}
            title={t.remove}
            disabled={disabled || busy}
            onClick={() => onChange("")}
            className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none pointer-coarse:size-11"
          >
            <IconClose className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
