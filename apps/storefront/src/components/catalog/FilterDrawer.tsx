"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/StoreContext";
import { useDialog, useSheetPresence } from "@/lib/useDialog";
import { CrossIcon } from "@/components/Icons";
import { backdrop, btnPrimaryLg, btnSecondary, iconBtn, modalLayer, sheet } from "@/components/ui";

/**
 * The filters on a phone: a "Filter (n)" button that slides a sheet in from
 * the inline-end edge — the same layer the cart and the menu use
 * (lib/useDialog: focus stays inside, Escape and the backdrop close it). The
 * filters inside apply as they change; the footer button closes the sheet
 * onto the updated list. Hidden from `lg`, where the sidebar shows instead.
 */
export function FilterDrawer({ count, total, children }: { count: number; total: number; children: ReactNode }) {
  const { t } = useStore();
  const [open, setOpen] = useState(false);
  const dialogRef = useDialog<HTMLDivElement>({ open, onClose: () => setOpen(false) });
  const { present, shown } = useSheetPresence(open);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="store-filter-sheet"
        className={btnSecondary}
      >
        {t.catalog.filterCount(count)}
      </button>
      {present &&
        createPortal(
          <div className={modalLayer}>
            <div className={backdrop(shown)} aria-hidden onClick={() => setOpen(false)} />
            <div
              ref={dialogRef}
              id="store-filter-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="store-filter-title"
              aria-hidden={!open}
              inert={!open}
              className={sheet(shown)}
            >
              <div className="flex h-16 items-center justify-between gap-3 border-b border-line px-4">
                <h2 id="store-filter-title" className="font-display text-lg font-bold text-ink">
                  {t.catalog.filters}
                </h2>
                <button type="button" onClick={() => setOpen(false)} aria-label={t.common.close} className={iconBtn}>
                  <CrossIcon />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">{children}</div>
              <div className="border-t border-line p-4">
                <button type="button" onClick={() => setOpen(false)} className={btnPrimaryLg}>
                  {t.catalog.showResults(total)}
                </button>
              </div>
            </div>
          </div>,
          document.querySelector<HTMLElement>(".brand-theme") ?? document.body
        )}
    </div>
  );
}
