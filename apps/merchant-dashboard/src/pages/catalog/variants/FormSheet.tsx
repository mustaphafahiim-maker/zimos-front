import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { SheetBody, SheetFooter, SheetFrame, SheetHeader, type SheetSize } from "@/components/Sheet";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  // The words of Modal's own question (components/Modal.tsx): one vocabulary for one decision.
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

export interface FormSheetProps {
  open: boolean;
  /** The sheet asks to close: Escape, the close button, a tap on the dimmed page, a pull down — after the question, if one was due. */
  onClose: () => void;
  title: string;
  description?: string;
  /** The actions, pinned under the body. Give the main one last. */
  footer?: ReactNode;
  size?: SheetSize;
  /** A save is running: the sheet stays until it answers. */
  locked?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * A `Sheet` that holds a form (components/Sheet.tsx — the same frame, header,
 * scrolling body and pinned footer): a bottom sheet with a grab handle on the
 * phone, a centred pane from 640px, opening on its first field.
 *
 * It adds the one thing a form needs: once something was typed in it, a stray
 * tap outside, Escape or a pull down first asks «تسيب التعديلات؟» instead of
 * throwing a half-filled variant away. A caller closing it itself — after a
 * save, or from its own Cancel button — is not asked.
 */
export function FormSheet({ open, onClose, title, description, footer, size = "md", locked = false, className, children }: FormSheetProps) {
  const t = useT(STRINGS);
  const questionId = useId();
  // Any typing inside the sheet since it opened makes a dismissal ask first.
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
        if (next || locked) return;
        if (dirty.current) setAsking(true);
        else onClose();
      }}
      side="auto"
      size={size}
      focusField
      className={className}
      popupProps={{ onInput: markDirty, onChange: markDirty }}
    >
      <SheetHeader title={title} description={description} />
      {asking && (
        <div
          role="alertdialog"
          aria-labelledby={questionId}
          data-slot="sheet-notice"
          className="mx-4 mb-3 shrink-0 rounded-[1.25rem] bg-accent-soft px-4 py-3"
        >
          <p id={questionId} className="text-sm font-semibold text-accent-dark">
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
