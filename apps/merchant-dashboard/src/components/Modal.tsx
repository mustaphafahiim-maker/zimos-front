import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { SheetBody, SheetFooter, SheetFrame, SheetHeader } from "@/components/Sheet";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    discardTitle: "Leave without saving?",
    discardBody: "What you typed here will be lost.",
    discard: "Leave it",
    keep: "Keep editing",
  },
  ar: {
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
 * The dashboard's dialog, in the same pane as `Sheet` (components/Sheet.tsx):
 * Base UI's Dialog underneath (docs/UI_RULES.md §8), so focus is trapped
 * inside and returned to what opened it. Escape, the close button, a tap on
 * the dimmed backdrop and — on a phone — pulling the sheet down close it; but
 * once something was typed in it, they first ask «تسيب التعديلات؟», so a stray
 * tap can't throw away a half-typed form (audit U-14, re-audit N-08). A caller
 * closing it itself (after a save, or its own Cancel button) is not asked. A
 * field that is not an edit stops its own `input` / `change` from reaching the
 * dialog and does not count.
 *
 * On a phone it rises as a sheet from the bottom, within thumb reach, with a
 * grab handle; from `sm` up it is centred. The body scrolls and the footer
 * stays pinned under it. Same props as before, so every caller keeps working;
 * `className` still sets the width (`max-w-2xl`…).
 */
export function Modal({ open, onClose, title, description, children, footer, className }: ModalProps) {
  const t = useT(STRINGS);
  const discardTitleId = useId();
  // Any typing inside the dialog since it opened makes a dismissal ask first.
  const dirty = useRef(false);
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (open) {
      dirty.current = false;
      setAsking(false);
    }
  }, [open]);

  const markDirty = () => {
    dirty.current = true;
  };

  return (
    <SheetFrame
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        if (dirty.current) setAsking(true);
        else onClose();
      }}
      side="auto"
      // The frost of liquid-glass.css keys on bg-paper-raised + shadow-[var(--shadow-pop)]; SheetFrame carries both.
      className={cn("max-w-lg", className)}
      popupProps={{ onInput: markDirty, onChange: markDirty }}
    >
      <SheetHeader title={title} description={description} />
      {asking && (
        <div
          role="alertdialog"
          aria-labelledby={discardTitleId}
          data-slot="sheet-notice"
          className="mx-4 mb-3 shrink-0 rounded-[1.25rem] bg-accent-soft px-4 py-3"
        >
          <p id={discardTitleId} className="text-sm font-semibold text-accent-dark">
            {t.discardTitle}
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">{t.discardBody}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              autoFocus
              onClick={() => setAsking(false)}
              className="min-h-11 cursor-pointer rounded-full bg-paper-raised px-4 text-sm font-semibold text-ink ring-1 ring-line-strong transition-[scale,background-color] duration-[var(--dur-fade)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none"
            >
              {t.keep}
            </button>
            <button
              type="button"
              onClick={() => {
                setAsking(false);
                onClose();
              }}
              className="min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold text-danger transition-[scale,background-color] duration-[var(--dur-fade)] hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none"
            >
              {t.discard}
            </button>
          </div>
        </div>
      )}
      <SheetBody>{children}</SheetBody>
      {footer && <SheetFooter>{footer}</SheetFooter>}
    </SheetFrame>
  );
}
