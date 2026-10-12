import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@store-builder/ui";
import { overlayTarget } from "./overlayRoot";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Side panel anchored to the inline-end edge, drawn as the merchant dashboard
 * draws its end sheet (its components/Sheet.tsx, side "end"): a rounded pane
 * that floats a little off the screen's edges over the dimmed page. The theme
 * gives it its glass on the `sheet` hooks (glass/sheet.css).
 *
 * Drawn in the layout's overlay root (overlayRoot.tsx), not where it is used:
 * a backdrop-blur or an entrance transform on any ancestor would otherwise
 * make position: fixed follow that box instead of the window.
 */
export function Drawer({ open, onClose, title, description, children, footer, className }: DrawerProps) {
  const target = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  target.current ??= overlayTarget();

  return createPortal(
    <div
      data-slot="sheet-backdrop"
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-ink/32 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:bg-black/55"
      onMouseDown={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-slot="sheet"
        data-side="end"
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          "animate-slide-in-end relative flex h-full min-h-0 w-full max-w-xl flex-col rounded-[1.75rem] bg-paper-raised text-ink shadow-[var(--shadow-pop)] ring-1 ring-line outline-none",
          className
        )}
      >
        <div data-slot="sheet-header" className="relative flex shrink-0 items-start gap-2 ps-5 pe-3 pt-3 pb-2.5">
          <div className="min-w-0 flex-1 py-2.5">
            <h2 data-slot="sheet-title" className="min-w-0 truncate font-display text-[17px] leading-6 font-semibold text-ink">
              {title}
            </h2>
            {description && (
              <p data-slot="sheet-description" className="mt-0.5 text-sm leading-5 text-ink-soft">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-slot="sheet-close"
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ink/6 text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-ink/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div
          data-slot="sheet-body"
          className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain border-y border-line px-5 py-4 last:rounded-b-[inherit] last:border-b-0"
        >
          {children}
        </div>
        {footer && (
          <div
            data-slot="sheet-footer"
            className="flex shrink-0 flex-col-reverse gap-2 px-5 pt-3 pb-4 *:data-[slot=button]:min-h-10 max-sm:*:data-[slot=button]:min-h-11 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3"
          >
            {footer}
          </div>
        )}
      </aside>
    </div>,
    target.current
  );
}

/** Definition list row used inside drawers and detail cards. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 border-b border-line py-2.5 text-sm last:border-0">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}
