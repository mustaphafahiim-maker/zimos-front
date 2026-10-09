import { DirectionProvider } from "@base-ui/react/direction-provider";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@store-builder/ui";
import type { LostOrderFilters } from "@store-builder/api-client";
import {
  IconCaretDown,
  IconChecklist,
  IconClock,
  IconDocument,
  IconRefresh,
  IconSheet,
  IconSpinner,
  IconTool,
} from "@/components/icons";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { countOf } from "@/lib/plural";
import { useLostOrdersExport } from "./LostOrdersExport";

const STRINGS = {
  en: {
    tools: "Tools",
    refresh: "Refresh the list",
    exportLabel: "Export what the filters show (up to {n} rows)",
    xlsx: "Export as Excel (.xlsx)",
    csv: "Export as CSV",
    exporting: "Exporting…",
    timing: "When a checkout counts as lost",
    timingNow: "After {span} without activity",
    select: "Select orders",
    selectHint: "Tick several and delete them together",
  },
  ar: {
    tools: "أدوات",
    refresh: "حدّث القايمة",
    exportLabel: "صدّر اللي الفلاتر عارضاه (لحد {n} صف)",
    xlsx: "صدّر Excel (.xlsx)",
    csv: "صدّر CSV",
    exporting: "بنصدّر…",
    timing: "إمتى الأوردر يتحسب مفقود",
    timingNow: "بعد {span} من غير نشاط",
    select: "حدّد أوردرات",
    selectHint: "علّم على كذا واحد وامسحهم مرة واحدة",
  },
} satisfies Messages;

/** A menu line: 40px with a mouse, 44px under a finger; rounded to sit inside the corners of the menu. */
const ITEM = "min-h-10 cursor-pointer items-start gap-3 rounded-[0.625rem] px-2.5 py-2 pointer-coarse:min-h-11";
const GLYPH = "mt-0.5 size-[18px] text-ink-soft";

/**
 * The header's «أدوات» menu: what is used rarely and so is not on the page —
 * refresh, the export (Excel or CSV, as the list is filtered now), the
 * abandon-after setting, and on a phone the way into selecting rows. An icon
 * button on a phone, the icon and its word from sm.
 */
export function LostOrdersTools({
  filters,
  minutes,
  refreshing,
  onRefresh,
  onOpenTiming,
  onSelect,
}: {
  /** The server filters in effect (tab included): what the export holds. */
  filters: LostOrderFilters;
  /** Minutes of silence after which a checkout counts as lost; null until known. */
  minutes: number | null;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenTiming: () => void;
  /** Turns the cards' tick boxes on. Offered below md only: the table always has its column. */
  onSelect: () => void;
}) {
  const t = useT(STRINGS);
  const { dir } = useLocale();
  const exporter = useLostOrdersExport(filters);

  return (
    <DirectionProvider direction={dir}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button type="button" variant="outline" title={t.tools} className="h-11 gap-2 rounded-full px-3 sm:h-10 sm:px-4" />}
        >
          {exporter.busy ? (
            <IconSpinner className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <IconTool className="size-5" aria-hidden />
          )}
          <span className="max-sm:sr-only">{exporter.busy ? t.exporting : t.tools}</span>
          <IconCaretDown className="size-4 text-ink-soft max-sm:hidden" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-auto max-w-[min(21rem,calc(100vw_-_1.5rem))] min-w-64 rounded-[1.125rem] p-1.5">
          <DropdownMenuItem className={ITEM} disabled={refreshing} onClick={onRefresh}>
            <IconRefresh className={GLYPH} aria-hidden />
            <span className="min-w-0 flex-1">{t.refresh}</span>
          </DropdownMenuItem>
          <DropdownMenuItem className={`${ITEM} md:hidden`} onClick={onSelect}>
            <IconChecklist className={GLYPH} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block">{t.select}</span>
              <span className="mt-0.5 block text-xs leading-4 text-ink-soft">{t.selectHint}</span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="mx-2 my-1" />
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2.5 pt-1.5 pb-1 text-xs leading-4 font-normal text-ink-soft">{fmt(t.exportLabel, { n: 5000 })}</DropdownMenuLabel>
            <DropdownMenuItem className={ITEM} disabled={exporter.busy} onClick={() => void exporter.run("xlsx")}>
              <IconSheet className={GLYPH} aria-hidden />
              <span className="min-w-0 flex-1">{t.xlsx}</span>
            </DropdownMenuItem>
            <DropdownMenuItem className={ITEM} disabled={exporter.busy} onClick={() => void exporter.run("csv")}>
              <IconDocument className={GLYPH} aria-hidden />
              <span className="min-w-0 flex-1">{t.csv}</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator className="mx-2 my-1" />
          <DropdownMenuItem className={ITEM} onClick={onOpenTiming}>
            <IconClock className={GLYPH} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block">{t.timing}</span>
              {minutes !== null && (
                <span className="mt-0.5 block text-xs leading-4 text-ink-soft">{fmt(t.timingNow, { span: countOf("minute", minutes) })}</span>
              )}
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </DirectionProvider>
  );
}
