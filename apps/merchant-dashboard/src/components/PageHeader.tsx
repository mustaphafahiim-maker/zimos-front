import type { ReactNode } from "react";
import { IconArrowLeft } from "@/components/icons";
import { cn } from "@store-builder/ui";
import type { TutorialTopic } from "@store-builder/api-client";
import { TutorialLink } from "./Education";
import { ViewLink } from "./ViewLink";

interface PageHeaderProps {
  title: string;
  /** Small muted text after the title, e.g. a product code "#482910573". */
  titleMeta?: string;
  /** Rendered on the title line, after the title and any `titleMeta`. */
  titleBadge?: ReactNode;
  description?: string;
  /** Renders a "← label" link above the title. */
  back?: { to: string; label: string };
  actions?: ReactNode;
  /**
   * The page's one creation action («أوردر جديد», «ضيف منتج»). From md up it
   * closes the actions row like any other action; on a phone it leaves the
   * header for a bar above the dock, where a thumb reaches it without a
   * stretch (docs/ux/06-design-system.md, principle 5). Opt-in: pages that
   * don't pass it look exactly as before.
   */
  primaryAction?: ReactNode;
  /** The page's tutorial video, shown under the description when the platform team has set one (Education.tsx). */
  tutorial?: TutorialTopic;
}

/**
 * The phone home of a page's primary action: fixed just above the dock
 * (components/MobileTabBar.tsx) and as wide as it, so the two float as one
 * stack; the child is stretched to the full width, one big thumb target.
 * Hidden from md up, where the action sits in the header instead.
 * `data-page-action` lets InstallAppPrompt move out of its way, and index.css
 * keep room for it under the page. PageHeader renders it from `primaryAction`;
 * a tab without a header of its own can render it directly.
 */
export function PageActionBar({ children }: { children: ReactNode }) {
  return (
    <div
      data-page-action
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md md:hidden [&>*]:min-h-11 [&>*]:w-full [&>*]:justify-center [&>*]:shadow-[var(--shadow-raised)]"
    >
      {children}
    </div>
  );
}

export function PageHeader({ title, titleMeta, titleBadge, description, back, actions, primaryAction, tutorial }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {back && (
        // A ghost pill, 44px tall for the thumb. Pulled back by its own padding so the
        // arrow lines up with the title under it. The way back is taken all day: it
        // loads the page ahead of the tap and changes page in a view transition.
        <ViewLink
          to={back.to}
          className="-ms-3 mb-1 inline-flex h-11 max-w-full items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-soft transition-[color,background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-primary-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:bg-primary-soft active:text-ink motion-safe:active:scale-[0.97] motion-reduce:transition-none"
        >
          <IconArrowLeft className="size-4 shrink-0 rtl:rotate-180" aria-hidden />
          <span className="truncate">{back.label}</span>
        </ViewLink>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink">
            {title}
            {titleMeta && (
              // No separator: size and colour already set the code apart, and a "·" is left
              // hanging at the end of the line when the code wraps under an Arabic title.
              <span className="ms-2 inline-block align-middle text-base font-normal text-ink-soft">
                <bdi dir="ltr">{titleMeta}</bdi>
              </span>
            )}
            {titleBadge && <span className="ms-2 align-middle">{titleBadge}</span>}
          </h1>
          {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
          {tutorial && <TutorialLink topic={tutorial} />}
        </div>
        {(actions || primaryAction) && (
          // Without `actions` the row only exists from md up, so a phone title
          // isn't squeezed by an empty flex item and its gap.
          <div className={cn("min-w-0 max-w-full flex-wrap items-center gap-2", actions ? "flex" : "hidden md:flex")}>
            {actions}
            {/* `contents` from md up: the action joins the row as if passed in `actions`. */}
            {primaryAction && <div className="hidden md:contents">{primaryAction}</div>}
          </div>
        )}
      </div>
      {primaryAction && <PageActionBar>{primaryAction}</PageActionBar>}
    </div>
  );
}
