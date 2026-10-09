import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@store-builder/ui";
import type { ProductMedia } from "@store-builder/api-client";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { IconArrowDown, IconArrowUp, IconDelete, IconImageMissing, IconStar } from "@/components/icons";
import { fmt, useT } from "@/i18n/LocaleContext";
import { mediaSrc } from "@/lib/media";
import { ItemMenu } from "./ItemMenu";
import { MEDIA_STRINGS } from "./mediaStrings";

/** The others make room on the house spring (index.css --ease-spring, --dur-move). */
const MAKE_ROOM = { duration: 320, easing: "var(--ease-spring)" } as const;

/** The shape every tile of the grid shares: a square with reserved space, so nothing shifts when a picture arrives. */
export const TILE =
  "zimos-pm-tile relative aspect-square overflow-hidden rounded-[1rem] bg-paper-sunken ring-1 ring-line";

export interface PhotoTileProps {
  /** Its name in the sortable grid (unique among the product's photos). */
  id: string;
  media: ProductMedia;
  index: number;
  total: number;
  /** Change place: from this index to that one. */
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  /** A mouse is in use: right-click gives the tile's menu too. */
  finePointer: boolean;
  /** Tiles change place without sliding. */
  reducedMotion: boolean;
}

/**
 * One photo of the product. The whole tile is the handle: drag it with a mouse,
 * press and hold then drag on a touch screen, or focus it and use Space and the
 * arrow keys. While held it lifts — a touch larger, a raised shadow, the
 * store's colour around it — and the others slide out of its way.
 *
 * The first tile is the main photo: twice the size, and it says so. «…» (and a
 * right-click) holds the same moves for anyone who would rather not drag: make
 * it the main photo, one place earlier, one place later, remove.
 */
export function PhotoTile({ id, media, index, total, onMove, onRemove, finePointer, reducedMotion }: PhotoTileProps) {
  const t = useT(MEDIA_STRINGS);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: reducedMotion ? null : MAKE_ROOM,
    attributes: { roleDescription: t.srRole },
  });
  const cover = index === 0;

  const menu: ContextMenuItem[] = [
    ...(cover ? [] : [{ id: "cover", label: t.makeCover, icon: IconStar, onSelect: () => onMove(index, 0) }]),
    { id: "earlier", label: t.moveEarlier, icon: IconArrowUp, onSelect: () => onMove(index, index - 1), disabled: index === 0 },
    { id: "later", label: t.moveLater, icon: IconArrowDown, onSelect: () => onMove(index, index + 1), disabled: index === total - 1 },
    { id: "remove", label: t.remove, icon: IconDelete, onSelect: () => onRemove(index), destructive: true, separatorBefore: true },
  ];
  const menuLabel = fmt(t.menu, { n: index + 1 });

  return (
    <li
      ref={setNodeRef}
      // The grid's slots differ in size (the main photo is larger): a tile on its way to another slot is moved and
      // scaled from its top corner, which is how the sorting strategy measures it.
      style={{ transform: CSS.Transform.toString(transform), transition, transformOrigin: "0 0" }}
      className={cn("relative list-none", cover && "col-span-2 row-span-2", isDragging && "z-20")}
    >
      <ContextMenu items={menu} label={menuLabel} disabled={!finePointer}>
        <div
          data-slot="photo-tile"
          data-cover={cover ? "" : undefined}
          data-dragging={isDragging ? "" : undefined}
          className={cn(
            TILE,
            "group/tile transition-[scale,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
            "data-[dragging]:scale-[1.04] data-[dragging]:shadow-[var(--shadow-pop)] data-[dragging]:ring-2 data-[dragging]:ring-primary"
          )}
        >
          <TilePicture media={media} />

          {/* The handle covers the picture. It is a sibling of the menu button, so pressing «…» never starts a drag. */}
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={fmt(cover ? t.tileCover : t.tile, { n: index + 1, total })}
            className="absolute inset-0 cursor-grab touch-manipulation rounded-[inherit] select-none [-webkit-touch-callout:none] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary active:cursor-grabbing"
          />

          {cover && (
            <span className="zimos-pm-cover pointer-events-none absolute start-2 top-2 inline-flex h-6 max-w-[calc(100%-3.5rem)] items-center gap-1 rounded-full bg-primary px-2.5 text-xs font-semibold text-primary-foreground">
              <IconStar className="size-3 shrink-0" weight="fill" aria-hidden />
              <span className="truncate">{t.cover}</span>
            </span>
          )}

          {/* Nothing hovers on a touch screen, so there the button stays on; a mouse reveals it. */}
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

/** The picture, or a quiet placeholder when the file no longer loads — never the browser's broken-image glyph. */
function TilePicture({ media }: { media: ProductMedia }) {
  const src = mediaSrc(media);
  // Remembering which src failed (not just "failed") lets a replaced picture show without an effect.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) {
    return (
      <span className="flex size-full items-center justify-center text-ink-soft/50">
        <IconImageMissing className="size-7" aria-hidden />
      </span>
    );
  }
  return (
    <img
      src={src}
      // The handle over it names the photo («صورة ٢ من ٥»); the picture itself adds nothing to read.
      alt=""
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
      className="pointer-events-none size-full object-cover select-none"
    />
  );
}
