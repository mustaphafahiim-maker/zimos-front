import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { IconDiscounts, IconGiftCards, IconOffers, type IconComponent } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { ViewLink } from "@/components/ViewLink";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Offers & discounts",
    tabs: "Offers and discounts sections",
    offers: "Offers",
    discounts: "Discount codes",
    giftCards: "Gift cards",
  },
  ar: {
    title: "العروض والخصومات",
    tabs: "أقسام العروض والخصومات",
    offers: "العروض",
    discounts: "رموز الخصم",
    giftCards: "بطاقات الهدايا",
  },
} satisfies Messages;

export type HubTab = "offers" | "discounts" | "giftCards";

const TABS: ReadonlyArray<{ key: HubTab; to: string; icon: IconComponent }> = [
  { key: "offers", to: "/offers", icon: IconOffers },
  { key: "discounts", to: "/discounts", icon: IconDiscounts },
  { key: "giftCards", to: "/gift-cards", icon: IconGiftCards },
];

interface OffersHubProps {
  /** The tab this page is. */
  tab: HubTab;
  /** Header actions of this tab (a tools button). */
  actions?: ReactNode;
  /** The tab's one creation action: in the header from md up, above the dock on a phone. */
  primaryAction?: ReactNode;
  children: ReactNode;
}

/**
 * The one frame of «العروض والخصومات»: the header and a row of three tabs —
 * offers, discount codes, gift cards. Each tab is a LINK to its own address
 * (/offers, /discounts, /gift-cards), so every tab is a real page: it can be
 * bookmarked, opened in a new tab, and Back returns to the tab before it. The
 * three pages render this frame with their own content inside.
 *
 * The row is a track of three equal segments on a phone (each 44px tall) and
 * hugs its labels from sm up. Material — the track, the brand fill of the
 * current tab, its slide between pages — is in glass/offers.css; without the
 * glass layer it is a sunken track with a solid brand pill.
 */
export function OffersHub({ tab, actions, primaryAction, children }: OffersHubProps) {
  const t = useT(STRINGS);
  return (
    <div className="max-w-6xl">
      <PageHeader title={t.title} actions={actions} primaryAction={primaryAction} />
      <nav
        aria-label={t.tabs}
        data-slot="hub-tabs"
        className="zimos-hub-tabs -mt-2 mb-4 grid w-full grid-cols-3 gap-1 rounded-full bg-paper-sunken p-1 ring-1 ring-line sm:inline-grid sm:w-auto"
      >
        {TABS.map(({ key, to, icon: TabIcon }) => {
          const current = key === tab;
          return (
            <ViewLink
              key={key}
              to={to}
              aria-current={current ? "page" : undefined}
              className={cn(
                "zimos-hub-tab inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium whitespace-nowrap select-none sm:h-10 sm:px-5 pointer-coarse:h-11",
                "transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100",
                current
                  ? "bg-primary font-semibold text-primary-foreground forced-colors:bg-[color:Highlight] forced-colors:text-[color:HighlightText]"
                  : "text-ink-soft hover:bg-paper-raised hover:text-ink"
              )}
            >
              <TabIcon className="size-4 shrink-0 max-[26rem]:hidden" aria-hidden />
              <span className="min-w-0 truncate">{t[key]}</span>
            </ViewLink>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
