import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@store-builder/ui";
import { overlayTarget } from "./overlayRoot";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Drawn in the layout's overlay root (overlayRoot.tsx), not where it is used:
 * a bar, panel or dialog around it with backdrop-filter or a transform would
 * otherwise hold the fixed backdrop to its own box and cut the dialog off.
 * The target is picked once per instance, on first open, so the dialog's
 * content is never remounted under the merchant.
 */
export function Modal({ open, onClose, title, description, children, footer, className }: ModalProps) {
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
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 py-12"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "zimos-glass glass-dialog w-full max-w-lg rounded-[var(--radius-card)]",
          className
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-medium text-ink">{title}</h2>
          {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-line px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    target.current
  );
}
