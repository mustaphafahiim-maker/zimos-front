import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    close: "Close",
    discardTitle: "Leave without saving?",
    discardBody: "What you typed here will be lost.",
    discard: "Leave it",
    keep: "Keep editing",
  },
  ar: {
    close: "إغلاق",
    discardTitle: "تسيب التعديلات؟",
    discardBody: "اللي كتبته هنا هيضيع.",
    discard: "سيبها",
    keep: "كمّل تعديل",
  },
} satisfies Messages;

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
 * The dashboard's dialog, on Base UI's Dialog (docs/UI_RULES.md §8): focus is
 * trapped inside and returned to what opened it. Escape, the close button and
 * a tap on the dimmed backdrop close it — but once something was typed in it,
 * they first ask «تسيب التعديلات؟», so a stray tap can't throw away a
 * half-typed form (audit U-14, re-audit N-08). A caller closing it itself
 * (after a save, or its own Cancel button) is not asked. On a phone it rises
 * as a sheet from the bottom, within thumb reach; from `sm` up it is centred.
 * Same props as before, so every caller keeps working.
 */
export function Modal({ open, onClose, title, description, children, footer, className }: ModalProps) {
  const t = useT(STRINGS);
  // Any typing inside the dialog since it opened makes a dismissal ask first.
  const dirty = useRef(false);
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (open) {
      dirty.current = false;
      setAsking(false);
    }
  }, [open]);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        if (dirty.current) setAsking(true);
        else onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-40 bg-ink/40 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <DialogPrimitive.Viewport className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto sm:items-start sm:p-4 sm:py-12">
          <DialogPrimitive.Popup
            onInput={() => {
              dirty.current = true;
            }}
            onChange={() => {
              dirty.current = true;
            }}
            className={cn(
              "flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[var(--radius-card)] bg-paper-raised text-ink shadow-[var(--shadow-pop)] ring-1 ring-line outline-none sm:max-h-none sm:rounded-[var(--radius-card)]",
              "transition-[transform,opacity] duration-200 data-[ending-style]:translate-y-4 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-4 data-[starting-style]:opacity-0 motion-reduce:transition-none",
              className
            )}
          >
            <div className="flex items-start gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="font-display text-lg font-semibold text-ink">{title}</DialogPrimitive.Title>
                {description && (
                  <DialogPrimitive.Description className="mt-1 text-sm text-ink-soft">{description}</DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close
                aria-label={t.close}
                className="-me-2 -mt-1 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
              >
                <X className="size-5" aria-hidden />
              </DialogPrimitive.Close>
            </div>
            {asking && (
              <div role="alertdialog" aria-labelledby="modal-discard-title" className="border-b border-line bg-accent-soft px-5 py-3">
                <p id="modal-discard-title" className="text-sm font-semibold text-accent-dark">
                  {t.discardTitle}
                </p>
                <p className="text-sm text-ink-soft">{t.discardBody}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    autoFocus
                    onClick={() => setAsking(false)}
                    className="min-h-11 cursor-pointer rounded-full bg-paper-raised px-4 text-sm font-semibold text-ink ring-1 ring-line-strong hover:bg-paper-sunken"
                  >
                    {t.keep}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAsking(false);
                      onClose();
                    }}
                    className="min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold text-danger hover:bg-danger-soft"
                  >
                    {t.discard}
                  </button>
                </div>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && (
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
                {footer}
              </div>
            )}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
