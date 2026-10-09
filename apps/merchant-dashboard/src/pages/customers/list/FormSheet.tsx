import { useEffect, useId, useState, type ReactNode } from "react";
import { SheetBody, SheetFooter, SheetFrame, SheetHeader, type SheetSize } from "@/components/Sheet";
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

interface FormSheetProps {
  open: boolean;
  /** Close it for good: asked for by the sheet only once nothing typed would be lost, or the merchant said to leave it. */
  onClose: () => void;
  title: string;
  description?: string;
  /** Something was typed: Escape, the close button, a tap outside and a pull down then ask before closing. */
  dirty?: boolean;
  /** A save is running: the sheet stays put until it answers. */
  busy?: boolean;
  /** Width from 640px: sm 26rem, md 34rem, lg 46rem. */
  size?: SheetSize;
  /** The actions, pinned under the body. Give the main one last. */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * A sheet that holds a form (components/Sheet.tsx: a bottom sheet on a phone,
 * a centred pane from 640px; the body scrolls, the actions stay pinned under
 * it). It adds one thing to `Sheet`: a half-typed form is not thrown away by a
 * stray tap — while `dirty`, a dismissal first asks «تسيب التعديلات؟», in
 * place, the way the dashboard's dialogs do. A caller that closes it itself
 * (after a save, or its own Cancel button) is not asked.
 */
export function FormSheet({ open, onClose, title, description, dirty = false, busy = false, size = "md", footer, children }: FormSheetProps) {
  const t = useT(STRINGS);
  const noticeId = useId();
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (open) setAsking(false);
  }, [open]);

  return (
    <SheetFrame
      open={open}
      onOpenChange={(next) => {
        if (next || busy) return;
        if (dirty) setAsking(true);
        else onClose();
      }}
      side="auto"
      size={size}
      focusField
    >
      <SheetHeader title={title} description={description} />
      {asking && (
        <div role="alertdialog" aria-labelledby={noticeId} data-slot="sheet-notice" className="mx-4 mb-3 shrink-0 rounded-[1.25rem] bg-accent-soft px-4 py-3">
          <p id={noticeId} className="text-sm font-semibold text-accent-dark">
            {t.discardTitle}
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">{t.discardBody}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              autoFocus
              onClick={() => setAsking(false)}
              className="min-h-11 cursor-pointer rounded-full bg-paper-raised px-4 text-sm font-semibold text-ink ring-1 ring-line-strong transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              {t.keep}
            </button>
            <button
              type="button"
              onClick={() => {
                setAsking(false);
                onClose();
              }}
              className="min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold text-danger transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              {t.discard}
            </button>
          </div>
        </div>
      )}
      <SheetBody>{children}</SheetBody>
      {footer !== undefined && footer !== null && footer !== false && <SheetFooter>{footer}</SheetFooter>}
    </SheetFrame>
  );
}
