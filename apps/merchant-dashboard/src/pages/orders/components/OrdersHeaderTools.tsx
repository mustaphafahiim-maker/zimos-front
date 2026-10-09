import { useState } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@store-builder/ui";
import { ordersManifestPdf } from "@store-builder/api-client";
import {
  IconClipboard,
  IconColumns,
  IconDocument,
  IconDownload,
  IconFileUp,
  IconMoreActions,
  IconPacked,
  IconRefresh,
  IconSchedule,
  IconSpinner,
} from "@/components/icons";
import { useToast } from "@/components/Toast";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useViewNavigate } from "@/lib/viewTransition";
import { openBlob, useDocumentError } from "../list/orderDocuments";
import { SyncFromFileDialog } from "../list/SyncFromFileDialog";
import { ExportOrdersDialog, type ExportOrdersFilters } from "./ExportOrders";
import { useOrderQueues } from "./OrderQueueLinks";

const STRINGS = {
  en: {
    tools: "Tools",
    refresh: "Refresh",
    board: "Board",
    manifestToday: "Today's manifest",
    sync: "Sync from file",
    export: "Export",
    schedule: "Delivery schedule",
    pickReady: "Pick everything ready to ship",
    pickups: "Pickups",
    pickupsOpen: "{label}, {count} still open",
  },
  ar: {
    tools: "أدوات",
    refresh: "تحديث",
    board: "اللوحة",
    manifestToday: "كشف تسليم النهارده",
    sync: "تحديث من ملف",
    export: "صدّر",
    schedule: "جدول التوصيل",
    pickReady: "جهّز كل الجاهز للشحن",
    pickups: "أوردرات الاستلام",
    pickupsOpen: "{label}، {count} لسه مفتوحة",
  },
} satisfies Messages;

/** A menu line: 36px with a mouse, 44px under a finger; rounded to sit inside the menu's own corners. */
const ITEM = "min-h-9 cursor-pointer gap-2.5 rounded-[0.625rem] px-2.5 pointer-coarse:min-h-11";
const GLYPH = "size-[18px] text-ink-soft";

/**
 * The orders list's «أدوات» menu, at the end of the page header: what is used
 * a few times a day, one tap away instead of on the page — Refresh, the board,
 * today's manifest for the courier, updating tracking from the courier's
 * file, the export, and the daily work queues (picking everything ready to
 * ship; the delivery schedule and the pickups, for a store that uses them).
 *
 * The dialogs it opens (sync, export) live here beside the menu, not inside
 * it, so they stay up after the menu has closed.
 */
export function OrdersHeaderTools({
  onRefresh,
  refreshing = false,
  onImported,
  exportFilters,
}: {
  onRefresh: () => void;
  /** The list is being read again: the button shows it. */
  refreshing?: boolean;
  /** The courier's file changed at least one order. */
  onImported: () => void;
  /** The list as it is filtered now: what «صدّر» writes. */
  exportFilters: ExportOrdersFilters;
}) {
  const t = useT(STRINGS);
  const { dir } = useLocale();
  const workspaceId = useWorkspaceId();
  const navigate = useViewNavigate();
  const toast = useToast();
  const documentError = useDocumentError();
  const queues = useOrderQueues();
  const [syncOpen, setSyncOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);

  async function manifestToday() {
    if (preparing) return;
    setPreparing(true);
    try {
      openBlob(await ordersManifestPdf(apiClient, workspaceId));
    } catch (err) {
      toast.error(documentError(err));
    } finally {
      setPreparing(false);
    }
  }

  const working = refreshing || preparing;

  return (
    <>
      <DirectionProvider direction={dir}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                aria-label={t.tools}
                title={t.tools}
                aria-busy={working || undefined}
                className="size-11 rounded-full p-0 md:w-auto md:gap-2 md:ps-3.5 md:pe-4"
              />
            }
          >
            {working ? (
              <IconSpinner className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <IconMoreActions className="size-5" aria-hidden />
            )}
            <span className="hidden md:inline">{t.tools}</span>
          </DropdownMenuTrigger>
          {/* The button is the last thing in the header: the menu hangs from the end of it. */}
          <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-auto min-w-60 rounded-[1.125rem] p-1.5">
            <DropdownMenuItem onClick={onRefresh} className={ITEM}>
              <IconRefresh className={GLYPH} aria-hidden />
              {t.refresh}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/orders/board")} className={ITEM}>
              <IconColumns className={GLYPH} aria-hidden />
              {t.board}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="mx-1.5" />
            <DropdownMenuItem onClick={() => void manifestToday()} className={ITEM}>
              <IconDocument className={GLYPH} aria-hidden />
              {t.manifestToday}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSyncOpen(true)} className={ITEM}>
              <IconFileUp className={GLYPH} aria-hidden />
              {t.sync}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setExportOpen(true)} className={ITEM}>
              <IconDownload className={GLYPH} aria-hidden />
              {t.export}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="mx-1.5" />
            {/* Pick everything waiting to ship (handoff 226). */}
            <DropdownMenuItem onClick={() => navigate("/orders/pick-list?ready=1")} className={ITEM}>
              <IconClipboard className={GLYPH} aria-hidden />
              {t.pickReady}
            </DropdownMenuItem>
            {/* The delivery schedule and the pickups queue, for a store that offers them (handoff 221, 225). */}
            {queues?.schedule && (
              <DropdownMenuItem onClick={() => navigate("/orders/delivery-schedule")} className={ITEM}>
                <IconSchedule className={GLYPH} aria-hidden />
                {t.schedule}
              </DropdownMenuItem>
            )}
            {queues?.pickups && (
              <DropdownMenuItem onClick={() => navigate("/orders/pickups")} className={ITEM}>
                <IconPacked className={GLYPH} aria-hidden />
                {/* How many are still to hand over: a figure at the end of the line, said in words to a screen reader. */}
                <span className="min-w-0 flex-1" aria-hidden={queues.open > 0 || undefined}>
                  {t.pickups}
                </span>
                {queues.open > 0 && (
                  <>
                    <span className="sr-only">{fmt(t.pickupsOpen, { label: t.pickups, count: queues.open })}</span>
                    <span
                      aria-hidden
                      className="zimos-chip-count inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft px-1.5 text-xs leading-none font-semibold text-accent-dark tabular-nums"
                      data-tone="attention"
                    >
                      {fmt("{n}", { n: queues.open })}
                    </span>
                  </>
                )}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </DirectionProvider>

      <SyncFromFileDialog open={syncOpen} onClose={() => setSyncOpen(false)} onImported={onImported} />
      {exportOpen && <ExportOrdersDialog filters={exportFilters} onClose={() => setExportOpen(false)} />}
    </>
  );
}
