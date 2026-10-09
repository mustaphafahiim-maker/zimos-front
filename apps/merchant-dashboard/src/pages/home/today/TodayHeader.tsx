import { Button, cn } from "@store-builder/ui";
import { IconPlus, IconProductAdd, IconStore } from "@/components/icons";
import { PageActionBar } from "@/components/PageHeader";
import { Segmented } from "@/components/Segmented";
import { ViewLink } from "@/components/ViewLink";
import { canViewAnalytics } from "@/lib/analyticsAccess";
import { findNavItem, isNavItemVisible } from "@/lib/navigation";
import { countOf } from "@/lib/plural";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { HOME_RANGES, type HomeRange } from "@/pages/home/today/homeTime";
import { LiveChip } from "@/pages/home/today/LiveChip";

const STRINGS = {
  en: {
    morning: "Good morning, {name}",
    evening: "Good evening, {name}",
    morningPlain: "Good morning",
    eveningPlain: "Good evening",
    period: "Period",
    today: "Today",
    newOrder: "New order",
    newProduct: "Add product",
  },
  ar: {
    morning: "صباح الخير يا {name}",
    evening: "مساء الخير يا {name}",
    morningPlain: "صباح الخير",
    eveningPlain: "مساء الخير",
    period: "الفترة",
    today: "النهارده",
    newOrder: "أوردر جديد",
    newProduct: "ضيف منتج",
  },
} satisfies Messages;

export interface TodayHeaderProps {
  workspaceId: string;
  range: HomeRange;
  onRangeChange: (range: HomeRange) => void;
  /** The member's role key: the range and the live chip are for roles that read analytics. */
  role: string | null | undefined;
  storeName: string | null | undefined;
  /** The member's full name; the greeting uses the first word of it. */
  userName: string | null | undefined;
}

/** A role sees an action only when it sees the page the action opens (same rule as the side menu). */
function canOpen(to: string, role: string | null | undefined): boolean {
  const item = findNavItem(to);
  return !item || isNavItemVisible(item, role);
}

/**
 * The top of «اليوم»: who is here and which store, who is on the store this
 * minute, the period every number below follows, and the page's ONE main
 * action — «أوردر جديد».
 *
 * Phone (three rows, about 135px): the greeting; the store with the live
 * chip beside it; the period as equal thirds across the screen. «أوردر جديد»
 * leaves the header for the bar above the dock (PageActionBar), where a thumb
 * reaches it; «ضيف منتج» is in the dock's المنتجات and in Spotlight.
 * Desktop: the same block at the start, and at the end one row — the period,
 * «ضيف منتج» as an outline button, «أوردر جديد» as the main button.
 */
export function TodayHeader({ workspaceId, range, onRangeChange, role, storeName, userName }: TodayHeaderProps) {
  const t = useT(STRINGS);
  const analytics = canViewAnalytics(role);
  const showNewOrder = canOpen("/orders/new", role);
  const showNewProduct = canOpen("/catalog/new", role);

  // Morning until noon on the merchant's own clock; a member with no name is still greeted.
  const firstName = (userName ?? "").trim().split(/\s+/)[0] ?? "";
  const morning = new Date().getHours() < 12;
  const greeting = firstName
    ? fmt(morning ? t.morning : t.evening, { name: firstName })
    : morning
      ? t.morningPlain
      : t.eveningPlain;

  const rangeLabel: Record<HomeRange, string> = {
    today: t.today,
    "7d": countOf("day", 7),
    "30d": countOf("day", 30),
  };

  const newOrder = (
    <>
      <IconPlus weight="bold" aria-hidden />
      {t.newOrder}
    </>
  );

  return (
    <header
      data-slot="home-header"
      className="zimos-home-header flex min-w-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-x-4"
    >
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold text-pretty text-ink">{greeting}</h1>
        {/* The row keeps the chip's height from the start, so nothing moves when the chip arrives. */}
        <div className={cn("mt-1 flex min-w-0 items-center gap-2.5", analytics && "min-h-9")}>
          {storeName && (
            // The name gives way first: the chip stays whole and the name is cut with an ellipsis.
            <p className="flex min-w-0 shrink-[999] items-center gap-1.5 overflow-hidden text-sm text-ink-soft">
              <IconStore className="size-4 shrink-0" aria-hidden />
              <bdi className="min-w-0 truncate">{storeName}</bdi>
            </p>
          )}
          {analytics && <LiveChip key={workspaceId} workspaceId={workspaceId} />}
        </div>
      </div>

      {/* Without the period there is nothing here on a phone, so the row only exists from md up.
          Beside a narrow side menu it drops under the greeting, and wraps, before it would overflow. */}
      <div className={cn("max-w-full min-w-0 flex-wrap items-center gap-2", analytics ? "flex" : "hidden md:flex")}>
        {analytics && (
          <Segmented
            size="sm"
            label={t.period}
            value={range}
            onChange={onRangeChange}
            options={HOME_RANGES.map((value) => ({ value, label: rangeLabel[value] }))}
            className="w-full md:w-auto"
          />
        )}
        {showNewProduct && (
          <Button variant="outline" asChild className="hidden md:inline-flex pointer-coarse:h-11">
            <ViewLink to="/catalog/new">
              <IconProductAdd aria-hidden />
              {t.newProduct}
            </ViewLink>
          </Button>
        )}
        {showNewOrder && (
          <Button asChild className="hidden md:inline-flex pointer-coarse:h-11">
            <ViewLink to="/orders/new">{newOrder}</ViewLink>
          </Button>
        )}
      </div>

      {/* The same action on a phone: one wide bar above the dock (hidden from md up by PageActionBar itself). */}
      {showNewOrder && (
        <PageActionBar>
          <Button asChild className="h-11">
            <ViewLink to="/orders/new">{newOrder}</ViewLink>
          </Button>
        </PageActionBar>
      )}
    </header>
  );
}
