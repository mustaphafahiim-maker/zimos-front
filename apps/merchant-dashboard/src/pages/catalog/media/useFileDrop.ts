import { useRef, useState, type DragEvent } from "react";

/** A drag that carries files from the desktop — not a tile being reordered, not a selection of text. */
function carriesFiles(event: DragEvent<HTMLElement>): boolean {
  const types = event.dataTransfer?.types;
  return types ? Array.from(types).includes("Files") : false;
}

export interface FileDrop {
  /** Files are being held over the zone right now: show the drop target. */
  over: boolean;
  /** Spread on the zone — the whole section, so a drop lands wherever it falls. */
  handlers: {
    onDragEnter: (event: DragEvent<HTMLElement>) => void;
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDragLeave: (event: DragEvent<HTMLElement>) => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
  };
}

/**
 * Files dropped anywhere on a section. Entering and leaving are counted,
 * because the browser reports them for every child the pointer crosses; the
 * zone is "over" from the first enter to the last leave. Without the
 * `preventDefault` on drag-over the browser would open the dropped file
 * instead of handing it to us.
 */
export function useFileDrop(onFiles: (files: File[]) => void, disabled = false): FileDrop {
  const depth = useRef(0);
  const [over, setOver] = useState(false);

  return {
    over: over && !disabled,
    handlers: {
      onDragEnter(event) {
        if (disabled || !carriesFiles(event)) return;
        event.preventDefault();
        depth.current += 1;
        setOver(true);
      },
      onDragOver(event) {
        if (disabled || !carriesFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      },
      onDragLeave(event) {
        if (disabled || !carriesFiles(event)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      },
      onDrop(event) {
        if (!carriesFiles(event)) return;
        // Even when uploads are off for a moment the file must not replace the page.
        event.preventDefault();
        depth.current = 0;
        setOver(false);
        if (disabled) return;
        const files = Array.from(event.dataTransfer.files ?? []);
        if (files.length > 0) onFiles(files);
      },
    },
  };
}
