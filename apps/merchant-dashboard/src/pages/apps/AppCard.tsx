import type { ReactNode } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, cn } from "@store-builder/ui";
import { IconMoreActions } from "@/components/icons";
import { useLocale } from "@/i18n/LocaleContext";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { SkeletonBar } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";

/** What the record says about an app: nothing more is drawn than these three. */
export type AppCardState = "installed" | "available" | "soon";

export interface AppCardProps {
  /** The 44px tile at the start: `AppTile`, or an outside app's own picture. */
  icon: ReactNode;
  name: string;
  /** One line of what it does. */
  description?: string | null;
  /** Quiet facts: the category and the price. Beside the action from md; under an installed app's name on a phone. */
  meta?: string;
  state: AppCardState;
  /** «متثبّت» — the chip an installed app wears. */
  installedLabel: string;
  /** «تجريبي» when the app is a test integration. */
  testLabel?: string;
  /** An installed app with a page: the whole card is a link to it. */
  to?: string | null;
  /** Otherwise the whole card opens the details. */
  onOpen: () => void;
  /** What a press on the card does, for a screen reader: «افتح {name}» / «تفاصيل {name}». */
  openLabel: string;
  /** The ONE action at the end: «ثبّت», «افتح», or the quiet «قريب». */
  action?: ReactNode;
  /** Right-click / long-press, and the «…» button when `showMenuButton`. */
  menu?: readonly ContextMenuItem[];
  menuLabel: string;
  showMenuButton?: boolean;
}

// The same box at every width: a 76px row on a phone, a card from md. Solid on its own;
// glass/list.css (`.zimos-row-card`) gives the pane.
const CARD =
  "zimos-row-card group/app relative flex min-h-[76px] items-center gap-3 rounded-[1.25rem] bg-paper-raised px-3.5 py-3 shadow-[var(--shadow-card)] ring-1 ring-line " +
  "md:h-full md:flex-col md:items-stretch md:gap-3 md:rounded-[1.5rem] md:p-4";

// The card is one big target: this is laid over it, the action and the menu are drawn above.
const OVERLAY =
  "absolute inset-0 cursor-pointer rounded-[inherit] outline-none transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] " +
  "hover:bg-ink/[0.03] active:bg-ink/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none";

/** A pill at a card's end: 36px to the eye, 44px to the thumb. */
export const APP_PILL =
  "relative h-9 shrink-0 rounded-full px-4 before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] active:scale-[0.97] motion-reduce:active:scale-100";

/** The coloured tile of an app that has no picture of its own. */
export function AppTile({ children, quiet = false, className }: { children: ReactNode; quiet?: boolean; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-[0.875rem] [&_svg]:size-[22px]",
        quiet ? "bg-paper-sunken text-ink-soft" : "bg-primary-soft text-primary",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * One app of the catalogue. On a phone a compact row: the tile, the name, one
 * line, the action at the end. From md a card: the same, with the category
 * and the price beside the action. The whole card opens the app's page when
 * it is installed and has one, its details otherwise; the action and the «…»
 * menu are separate controls drawn above that target, never inside it.
 */
export function AppCard({
  icon,
  name,
  description,
  meta,
  state,
  installedLabel,
  testLabel,
  to,
  onOpen,
  openLabel,
  action,
  menu = [],
  menuLabel,
  showMenuButton = false,
}: AppCardProps) {
  const { dir } = useLocale();
  const installed = state === "installed";
  const soon = state === "soon";

  return (
    <ContextMenu items={menu} label={menuLabel}>
      <li data-slot="app-card" data-state={state} className={CARD}>
        {to ? (
          <ViewLink to={to} aria-label={openLabel} className={OVERLAY} />
        ) : (
          <button type="button" aria-label={openLabel} onClick={onOpen} className={OVERLAY} />
        )}

        <div className="pointer-events-none relative flex min-w-0 flex-1 items-center gap-3 md:flex-none md:items-start">
          {icon}
          <div className="min-w-0 flex-1">
            <h3 className="flex min-w-0 items-center gap-2 text-[15px] leading-6 font-semibold">
              <span className={cn("truncate", soon ? "text-ink-soft" : "text-ink")}>{name}</span>
              {testLabel && <StatusBadge value="test" tone="warning" text={testLabel} className="shrink-0" />}
              {installed && <StatusBadge value="installed" tone="success" text={installedLabel} className="shrink-0 max-md:hidden" />}
            </h3>
            {installed && (
              // A phone row of an installed app says its state where the description would be.
              <div className="mt-0.5 flex min-w-0 items-center gap-2 md:hidden">
                <StatusBadge value="installed" tone="success" text={installedLabel} className="shrink-0" />
                {meta && <span className="truncate text-xs text-ink-soft">{meta}</span>}
              </div>
            )}
            {description && (
              <p
                className={cn(
                  "mt-0.5 truncate text-sm leading-5 text-ink-soft md:line-clamp-2 md:min-h-10 md:whitespace-normal",
                  installed && "max-md:hidden"
                )}
              >
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="pointer-events-none relative flex shrink-0 items-center gap-1 md:mt-auto md:justify-between md:gap-3">
          <span className="min-w-0 truncate text-xs text-ink-soft max-md:hidden">{meta}</span>
          <div className="pointer-events-auto flex shrink-0 items-center gap-1">
            {action}
            {showMenuButton && menu.length > 0 && (
              <DirectionProvider direction={dir}>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        aria-label={menuLabel}
                        title={menuLabel}
                        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-ink/8 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] aria-expanded:bg-ink/8 aria-expanded:text-ink motion-reduce:transition-none motion-reduce:active:scale-100"
                      />
                    }
                  >
                    <IconMoreActions className="size-5" weight="bold" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="bottom" align="end" sideOffset={6} className="w-auto min-w-48 rounded-[1.125rem] p-1.5">
                    {menu.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <DropdownMenuItem
                          key={item.id}
                          variant={item.destructive ? "destructive" : "default"}
                          disabled={item.disabled}
                          onClick={item.onSelect}
                          className="min-h-9 cursor-pointer gap-3 rounded-[0.625rem] px-2.5 pointer-coarse:min-h-11"
                        >
                          {ItemIcon && <ItemIcon className="size-4 shrink-0" aria-hidden />}
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </DirectionProvider>
            )}
          </div>
        </div>
      </li>
    </ContextMenu>
  );
}

/** The grid every block of the page lies on: rows on a phone, two cards from md, three from xl. */
export function AppGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 md:gap-3 xl:grid-cols-3 [&>li]:min-w-0", className)}>{children}</ul>;
}

const NAME = ["w-2/5", "w-1/2", "w-1/3", "w-3/5"] as const;
const LINE = ["w-4/5", "w-2/3", "w-3/4", "w-3/5"] as const;

/** The catalogue while it loads: the same boxes, exactly as tall, so nothing jumps when the apps arrive. */
export function AppGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <AppGrid>
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className={cn(CARD, "md:min-h-[9.5rem]")}>
          <div className="flex min-w-0 flex-1 items-center gap-3 md:flex-none md:items-start">
            <SkeletonBar className="size-11 shrink-0 rounded-[0.875rem]" />
            <div className="min-w-0 flex-1">
              <SkeletonBar className={cn("h-3.5", NAME[index % NAME.length])} />
              <SkeletonBar className={cn("mt-2.5 h-2.5", LINE[index % LINE.length])} />
            </div>
          </div>
          <div className="flex shrink-0 items-center md:mt-auto md:justify-between">
            <SkeletonBar className="h-2.5 w-20 max-md:hidden" />
            <SkeletonBar className="h-9 w-16" />
          </div>
        </li>
      ))}
    </AppGrid>
  );
}
