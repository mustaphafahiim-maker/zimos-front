import { cn } from "@store-builder/ui";
import type { ProductMedia } from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { IconDelete, IconPlay, IconSpinner, IconSwap, IconVideo } from "@/components/icons";
import { fmt, useT } from "@/i18n/LocaleContext";
import { mediaSrc } from "@/lib/media";
import { ItemMenu } from "./ItemMenu";
import { MEDIA_STRINGS } from "./mediaStrings";
import { TILE } from "./PhotoTile";

/** What the picker offers; the same two types the section checks before it uploads. */
export const VIDEO_ACCEPT = "video/mp4,video/webm";

/**
 * The product's video as a tile in the photos' own language: the first frame
 * as its poster, a play glyph over it, and «…» for replace and remove. Pressing
 * the tile plays the video in a sheet; the tile itself never plays, so the
 * grid stays still.
 */
export function VideoTile({
  video,
  index,
  busy,
  finePointer,
  onPlay,
  onReplace,
  onRemove,
}: {
  video: ProductMedia;
  index: number;
  /** An upload or a save is running: the tile waits. */
  busy: boolean;
  finePointer: boolean;
  onPlay: () => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const t = useT(MEDIA_STRINGS);
  const menu: ContextMenuItem[] = [
    { id: "play", label: t.videoPlay, icon: IconPlay, onSelect: onPlay },
    { id: "replace", label: t.videoReplace, icon: IconSwap, onSelect: onReplace, disabled: busy },
    { id: "remove", label: t.videoRemove, icon: IconDelete, onSelect: onRemove, destructive: true, disabled: busy, separatorBefore: true },
  ];
  const menuLabel = fmt(t.videoMenu, { n: index + 1 });

  return (
    <li className="relative list-none">
      <ContextMenu items={menu} label={menuLabel} disabled={!finePointer}>
        <div data-slot="video-tile" className={cn(TILE, "group/tile bg-black")}>
          {/* The fragment asks for a frame a moment in: without it some phones draw nothing until the video plays. */}
          <video
            src={`${mediaSrc(video)}#t=0.1`}
            preload="metadata"
            muted
            playsInline
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none size-full object-cover"
          />
          <button
            type="button"
            onClick={onPlay}
            aria-label={fmt(t.videoPlayNamed, { n: index + 1 })}
            className="group/play absolute inset-0 flex cursor-pointer items-center justify-center rounded-[inherit] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          >
            <span className="zimos-pm-play flex size-11 items-center justify-center rounded-full bg-black/60 text-white transition-[scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] group-hover/play:scale-105 group-active/play:scale-[0.97] motion-reduce:transition-none motion-reduce:group-hover/play:scale-100">
              <IconPlay className="size-5" weight="fill" aria-hidden />
            </span>
          </button>
          <span className="pointer-events-none absolute start-2 bottom-2 inline-flex h-6 items-center gap-1 rounded-full bg-black/60 px-2 text-[11px] font-medium text-white">
            <IconVideo className="size-3.5" weight="fill" aria-hidden />
            {t.videoTitle}
          </span>
          {busy && (
            <span role="status" className="absolute inset-0 flex items-center justify-center bg-black/55 text-white">
              <IconSpinner className="size-6 animate-spin motion-reduce:animate-none" aria-hidden />
              <span className="sr-only">{t.videoUploading}</span>
            </span>
          )}
          <ItemMenu
            tone="photo"
            items={menu}
            label={menuLabel}
            className="absolute end-1.5 top-1.5 z-10 pointer-fine:opacity-0 pointer-fine:group-hover/tile:opacity-100 pointer-fine:group-focus-within/tile:opacity-100 pointer-fine:aria-expanded:opacity-100"
          />
        </div>
      </ContextMenu>
    </li>
  );
}

/** «ارفع فيديو»: the tile after the videos — or, with no video yet, the only one. While a file uploads it says so. */
export function AddVideoTile({
  busy,
  onFile,
}: {
  busy: boolean;
  onFile: (file: File) => void;
}) {
  const t = useT(MEDIA_STRINGS);
  return (
    <li className="list-none">
      <label
        data-slot="video-add"
        aria-busy={busy || undefined}
        className={cn(
          "zimos-pm-add flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[1rem] border-2 border-dashed border-line-strong bg-paper-raised p-2 text-center text-ink-soft",
          "transition-[scale,border-color,color,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
          "hover:border-primary hover:text-primary-dark has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary motion-safe:active:scale-[0.97] dark:hover:text-primary",
          busy && "pointer-events-none"
        )}
      >
        {busy ? (
          <IconSpinner className="size-6 animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          <IconVideo className="size-6" aria-hidden />
        )}
        <span className="text-xs leading-4 font-semibold">{busy ? t.videoUploading : t.videoAdd}</span>
        <input
          type="file"
          accept={VIDEO_ACCEPT}
          disabled={busy}
          aria-label={t.videoAdd}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onFile(file);
          }}
        />
      </label>
    </li>
  );
}
