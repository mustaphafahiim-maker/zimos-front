import { useEffect, useMemo, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { AccordionSection } from "@/components/Accordion";
import { useMediaQuery } from "@/components/report/useMediaQuery";
import { useT } from "@/i18n/LocaleContext";
import { ProductCardFrameProvider } from "../components/ProductPageCard";
import { ProductGroupContext, type ProductGroupValue } from "./groupContext";
import { DESKTOP_QUERY, GROUP_ICONS, GROUP_STRINGS, revealGroup, type GroupKey } from "./groups";
import { useDirtyGroups } from "./saveQueue";

interface ProductGroupProps {
  group: GroupKey;
  /** Phone, folded: one line of what is inside («٣ صور», «٤ متغيرات — من ٢٥٠ ج.م»). */
  summary?: ReactNode;
  /** Phone: open on the first visit (the first two groups). The choice is then remembered for the tab. */
  defaultOpen?: boolean;
  /** A control on the title line that works without opening the group (the status switch). */
  actions?: ReactNode;
  /** The group holds one section: its title is the group's, so the section says only its description. */
  solo?: boolean;
  /** Open the group and bring it into view once it is on the page (a link that asked for something inside it). */
  openWhen?: boolean;
  children: ReactNode;
}

/**
 * One group of the product page. The same element on every screen, so what is
 * typed inside is never mounted twice and survives turning the screen:
 *
 *  - on a phone it is an `AccordionSection` — one 56px row with an icon, the
 *    name and a line of what is inside, kept mounted while folded (an unsaved
 *    edit is never lost by closing a section) and remembered per tab;
 *  - from `lg` up it is always open: the accordion's toggle row is taken out
 *    and a plain titled head stands in its place. The index beside the page
 *    does the travelling.
 *
 * Sections inside draw themselves as parts of the group (ProductPageCard's
 * `part` frame): the group is the pane.
 */
export function ProductGroup({ group, summary, defaultOpen = false, actions, solo = false, openWhen = false, children }: ProductGroupProps) {
  const t = useT(GROUP_STRINGS);
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const unsaved = useDirtyGroups().has(group);
  const Icon = GROUP_ICONS[group];
  const title = t[group];

  const value = useMemo<ProductGroupValue>(() => ({ group, reveal: () => revealGroup(group) }), [group]);

  // A link that points inside this group (`#seo`, `?tab=questions`) opens it; the accordion below is already listening.
  useEffect(() => {
    if (openWhen) revealGroup(group);
    else if (window.location.hash === `#${group}`) revealGroup(group);
    // Once, when the group arrives with the product.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dot = unsaved ? (
    <span role="img" aria-label={t.unsaved} title={t.unsaved} className="zimos-product-unsaved block size-2.5 rounded-full bg-accent" />
  ) : undefined;

  return (
    <ProductGroupContext.Provider value={value}>
      <AccordionSection
        id={group}
        title={title}
        icon={Icon}
        summary={summary}
        badge={dot}
        actions={desktop ? undefined : actions}
        defaultOpen={defaultOpen}
        open={desktop ? true : undefined}
        persistKey={`product:${group}`}
        keepMounted
        className={cn(
          "zimos-product-group",
          // From lg up the toggle row (the section's first child) is not drawn, and the body takes a pane's padding.
          "lg:[&>div:first-child]:hidden lg:[&>.zimos-accordion-body]:border-t-0 lg:[&>.zimos-accordion-body]:p-6"
        )}
      >
        {desktop && (
          <div className="zimos-product-group-head mb-5 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2">
            <span className="zimos-accordion-chip flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon className="size-[18px]" weight="fill" aria-hidden />
            </span>
            <h2 className="min-w-0 flex-1 text-[17px] leading-6 font-semibold text-ink">{title}</h2>
            {dot}
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
        )}
        <ProductCardFrameProvider frame={solo ? "solo" : "part"}>
          <div className="zimos-product-parts flex min-w-0 flex-col">{children}</div>
        </ProductCardFrameProvider>
      </AccordionSection>
    </ProductGroupContext.Provider>
  );
}
