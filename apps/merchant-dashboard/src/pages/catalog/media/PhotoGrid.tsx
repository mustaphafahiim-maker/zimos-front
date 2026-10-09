import { useMemo } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { ProductMedia } from "@store-builder/api-client";
import { fmt, useT } from "@/i18n/LocaleContext";
import { MEDIA_STRINGS } from "./mediaStrings";
import { PhotoTile } from "./PhotoTile";
import { AddPhotoTile, UploadTile } from "./UploadTiles";
import { FINE_POINTER_QUERY, REDUCED_MOTION_QUERY, useMediaQuery } from "./useMediaQuery";
import type { PendingUpload } from "./usePhotoUploads";

/**
 * A name for each photo in the sortable grid. A photo is known by its file
 * (`path`, or `url` for an old entry without one); the same file added twice
 * gets «…#2», so two tiles never answer to one name.
 */
export function mediaIds(items: readonly ProductMedia[]): string[] {
  const seen = new Map<string, number>();
  return items.map((media) => {
    const base = media.path || media.url;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}#${count}`;
  });
}

export interface PhotoGridProps {
  items: readonly ProductMedia[];
  /** Files still on their way, drawn after the photos. */
  pending: readonly PendingUpload[];
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  onAddFiles: (files: File[]) => void;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
  /** A save is running: no new files for a moment. */
  locked?: boolean;
}

/**
 * The product's photos as a grid that can be rearranged by hand: three to a
 * row on a phone, five or six on a desktop, the first one — the main photo —
 * twice the size. After the photos come the files still uploading, each as its
 * own tile, and last «ارفع صور».
 *
 * Reordering is @dnd-kit's sortable: a mouse drags after 6px (so a click is
 * not a drag), a finger after a short hold (so a swipe still scrolls the
 * page), and the keyboard picks a tile up with Space, moves it with the arrows
 * and puts it down with Space. What the screen reader hears is in the page's
 * language.
 */
export function PhotoGrid({ items, pending, onMove, onRemove, onAddFiles, onRetry, onDismiss, locked = false }: PhotoGridProps) {
  const t = useT(MEDIA_STRINGS);
  const ids = useMemo(() => mediaIds(items), [items]);
  const finePointer = useMediaQuery(FINE_POINTER_QUERY, false);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY, false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onMove(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
  }

  const place = (id: UniqueIdentifier) => ids.indexOf(String(id)) + 1;
  const total = ids.length;
  const announcements: Announcements = {
    onDragStart: ({ active }) => fmt(t.srPicked, { n: place(active.id), total }),
    onDragOver: ({ over }) => (over ? fmt(t.srMoved, { n: place(over.id), total }) : undefined),
    onDragEnd: ({ over }) => (over ? fmt(t.srDropped, { n: place(over.id), total }) : t.srCancelled),
    onDragCancel: () => t.srCancelled,
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t.srInstructions } }}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <ul
          data-slot="photo-grid"
          aria-label={t.gridLabel}
          className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 xl:grid-cols-6"
        >
          {items.map((media, index) => (
            <PhotoTile
              key={ids[index]}
              id={ids[index]}
              media={media}
              index={index}
              total={total}
              onMove={onMove}
              onRemove={onRemove}
              finePointer={finePointer}
              reducedMotion={reducedMotion}
            />
          ))}
          {pending.map((upload) => (
            <UploadTile key={upload.id} upload={upload} onRetry={onRetry} onDismiss={onDismiss} />
          ))}
          <AddPhotoTile wide={items.length === 0 && pending.length === 0} disabled={locked} onFiles={onAddFiles} />
        </ul>
      </SortableContext>
    </DndContext>
  );
}
