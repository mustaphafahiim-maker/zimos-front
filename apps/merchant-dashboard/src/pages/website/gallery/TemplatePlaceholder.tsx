import { cn } from "@store-builder/ui";
import { IconLayout } from "@/components/icons";

/**
 * Stands in for a template with no picture and no live render (yet, or at
 * all): a sketch of a store on a phone — header, opening section, two
 * products — so the grid keeps its rhythm instead of showing a bare icon.
 * Decorative: the card's text already names the template. Fills the box it is
 * given.
 *
 * `label` adds a strip of words along the bottom, for the large preview, where
 * a render that never arrives should say so.
 */
export function TemplatePlaceholder({ label, className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col gap-2 overflow-hidden bg-primary-soft p-3 text-primary-dark dark:text-primary",
        className
      )}
    >
      <div aria-hidden className="flex items-center gap-1.5 rounded-md bg-paper-raised/80 px-2 py-1.5">
        <span className="size-2 rounded-full bg-current opacity-60" />
        <span className="h-1.5 w-10 rounded-full bg-current opacity-40" />
        <span className="ms-auto h-1.5 w-5 rounded-full bg-current opacity-25" />
      </div>
      <div aria-hidden className="flex flex-[1.25] flex-col justify-end gap-1.5 rounded-md bg-paper-raised/60 p-2.5">
        <IconLayout className="mb-auto size-7 opacity-45" weight="duotone" />
        <span className="block h-2 w-3/4 rounded-full bg-current opacity-40" />
        <span className="block h-1.5 w-1/2 rounded-full bg-current opacity-25" />
        <span className="mt-1 block h-3.5 w-12 rounded-full bg-current opacity-50" />
      </div>
      <div aria-hidden className="grid flex-1 grid-cols-2 gap-2">
        <span className="rounded-md bg-paper-raised/60" />
        <span className="rounded-md bg-paper-raised/60" />
      </div>
      {label && (
        <span className="absolute inset-x-0 bottom-0 bg-paper-raised/90 px-2 py-1.5 text-center text-xs font-medium text-ink-soft">
          {label}
        </span>
      )}
    </div>
  );
}
