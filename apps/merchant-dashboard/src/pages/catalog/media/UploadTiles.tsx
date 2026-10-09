import { cn } from "@store-builder/ui";
import { IconClose, IconImageAdd, IconRefresh, IconSpinner, IconWarning } from "@/components/icons";
import { fmt, useT } from "@/i18n/LocaleContext";
import { ACCEPTED_IMAGE_ACCEPT } from "@/lib/media";
import { MEDIA_STRINGS } from "./mediaStrings";
import { TILE } from "./PhotoTile";
import type { PendingUpload } from "./usePhotoUploads";

/** The round button in a tile's corner: 32px to the eye, 44px to the thumb (the ring of air around it is part of the target). */
const TILE_BUTTON =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] before:absolute before:-inset-1.5 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:active:scale-[0.97] motion-reduce:transition-none";

/**
 * A file on its way: the picture itself (from the device, before the server
 * has it) under a veil, with what is happening to it — being made smaller,
 * uploading — and a bar that keeps moving. If it fails the tile says so and
 * offers to try again; a file that can never go through only offers to be
 * taken away. The reason is written under the grid, where there is room.
 */
export function UploadTile({
  upload,
  onRetry,
  onDismiss,
}: {
  upload: PendingUpload;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const t = useT(MEDIA_STRINGS);
  const failed = upload.phase === "error";

  return (
    <li data-slot="photo-upload" data-phase={upload.phase} className={cn(TILE, "list-none")}>
      {upload.previewUrl && (
        <img
          src={upload.previewUrl}
          alt=""
          draggable={false}
          className={cn("size-full object-cover", failed ? "opacity-25 grayscale" : "opacity-60")}
        />
      )}

      {failed ? (
        <div role="group" aria-label={upload.name} className="zimos-pm-error absolute inset-0 bg-danger-soft/90 text-danger">
          {upload.retryable ? (
            // The whole tile tries again: on a phone a tile is too small for two thumb-sized buttons side by side.
            <button
              type="button"
              onClick={() => onRetry(upload.id)}
              aria-label={fmt(t.retryNamed, { name: upload.name })}
              className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[inherit] px-1 pt-6 text-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <IconRefresh className="size-5 shrink-0" weight="bold" aria-hidden />
              <span className="line-clamp-1 text-[11px] leading-4 font-semibold">{t.uploadFailed}</span>
              <span className="line-clamp-1 text-[11px] leading-4 underline underline-offset-2">{t.retry}</span>
            </button>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-1 pt-6 text-center">
              <IconWarning className="size-5 shrink-0" weight="fill" aria-hidden />
              <span className="line-clamp-2 text-[11px] leading-4 font-semibold">{t.uploadFailed}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => onDismiss(upload.id)}
            aria-label={fmt(t.dismissNamed, { name: upload.name })}
            title={t.dismiss}
            className={cn(TILE_BUTTON, "absolute end-1.5 top-1.5 z-10 bg-paper-raised text-ink ring-1 ring-line hover:bg-paper-sunken")}
          >
            <IconClose className="size-4" weight="bold" aria-hidden />
          </button>
        </div>
      ) : (
        <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/40 text-white">
          <IconSpinner className="size-6 animate-spin motion-reduce:animate-none" aria-hidden />
          <span className="rounded-full bg-black/55 px-2 py-0.5 text-[11px] leading-4 font-medium">
            <span className="sr-only">{upload.name}: </span>
            {upload.phase === "preparing" ? t.preparing : t.uploading}
          </span>
          {/* No percentage comes back from the upload, so the bar says "working", not "how far". */}
          <span aria-hidden dir="ltr" className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-white/30">
            <span className="block h-full w-2/5 rounded-full bg-white motion-safe:animate-[product-media-progress_1.3s_ease-in-out_infinite]" />
          </span>
        </div>
      )}
    </li>
  );
}

/**
 * «ارفع صور»: the last tile of the grid, and — while the product has no photo
 * yet — the whole row, saying what to do. A real file input sits inside the
 * label, so Tab reaches it and Enter opens the picker.
 */
export function AddPhotoTile({
  wide,
  disabled,
  onFiles,
}: {
  /** Nothing in the grid yet: the tile fills the row and explains itself. */
  wide: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const t = useT(MEDIA_STRINGS);
  return (
    <li className={cn("list-none", wide && "col-span-full")}>
      <label
        data-slot="photo-add"
        data-wide={wide ? "" : undefined}
        className={cn(
          "zimos-pm-add flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[1rem] border-2 border-dashed border-line-strong bg-paper-raised p-2 text-center text-ink-soft",
          "transition-[scale,border-color,color,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
          "hover:border-primary hover:text-primary-dark has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary motion-safe:active:scale-[0.97] dark:hover:text-primary",
          wide ? "min-h-40 px-4 py-6" : "aspect-square",
          disabled && "pointer-events-none opacity-60"
        )}
      >
        <IconImageAdd className={wide ? "size-10" : "size-6"} weight={wide ? "duotone" : "regular"} aria-hidden />
        {wide ? (
          <>
            <span className="text-[15px] font-semibold text-ink">{t.emptyTitle}</span>
            <span className="text-xs">{t.emptyHint}</span>
          </>
        ) : (
          <span className="text-xs leading-4 font-semibold">{t.add}</span>
        )}
        <input
          type="file"
          accept={ACCEPTED_IMAGE_ACCEPT}
          multiple
          disabled={disabled}
          aria-label={t.add}
          className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            // The same file can be chosen again after a removal.
            event.target.value = "";
            if (files.length > 0) onFiles(files);
          }}
        />
      </label>
    </li>
  );
}
