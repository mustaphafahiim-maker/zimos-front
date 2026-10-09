import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import type { IconComponent } from "@/components/icons";
import type { FileDrop } from "./useFileDrop";

interface DropZoneProps {
  /** From `useFileDrop`: whether files are held over the zone, and the listeners that find out. */
  drop: FileDrop;
  /** Said on the target while files are held over it: «سيب الصور هنا». */
  label: string;
  icon: IconComponent;
  /** The zone's `data-slot`, for the glass layer. */
  slot: string;
  className?: string;
  children: ReactNode;
}

/**
 * Everything a file can be dropped on: the grid, the notes under it, the air
 * between them. While files are held over it a dashed target covers the whole
 * zone and says what will happen; it takes no presses and never moves what is
 * under it (it only fades in).
 */
export function DropZone({ drop, label, icon: Icon, slot, className, children }: DropZoneProps) {
  return (
    <div data-slot={slot} data-over={drop.over ? "" : undefined} className={cn("zimos-pm-zone relative min-w-0", className)} {...drop.handlers}>
      {children}
      <div
        aria-hidden
        data-slot="media-drop"
        data-over={drop.over ? "" : undefined}
        className="zimos-pm-drop pointer-events-none absolute -inset-2 z-30 flex flex-col items-center justify-center gap-2 rounded-[1.25rem] border-2 border-dashed border-primary bg-primary-soft text-primary-dark opacity-0 transition-opacity duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none data-[over]:opacity-100 dark:text-primary"
      >
        <Icon className="size-8" weight="duotone" aria-hidden />
        <span className="px-3 text-center text-[15px] font-semibold">{label}</span>
      </div>
    </div>
  );
}
