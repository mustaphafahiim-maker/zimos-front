import type { ReactNode } from "react";
import { ProductPageCard } from "../components/ProductPageCard";

interface SectionFrameProps {
  title: string;
  /** One or two sentences under the title. */
  description?: string;
  /** After the title: a count («٣ صور»), the star of a required section. */
  badge?: ReactNode;
  /** At the end of the title line: the section's own buttons. */
  actions?: ReactNode;
  /** No frame and no visible title: the page around the section already has both. */
  embedded?: boolean;
  children: ReactNode;
}

/**
 * The frame of the photos, the video and the variants. It is the product
 * page's own frame (`ProductPageCard`), so the section is a card when it
 * stands alone — the new-product form, any other screen — and a titled part
 * of its group on the product page, with no card inside the group's pane.
 *
 * `embedded` is for a caller that draws the title itself: the section then
 * keeps only its description and its buttons.
 */
export function SectionFrame({ title, description, badge, actions, embedded = false, children }: SectionFrameProps) {
  if (!embedded) {
    return (
      <ProductPageCard title={title} description={description} badge={badge} actions={actions}>
        {children}
      </ProductPageCard>
    );
  }
  return (
    <section aria-label={title} className="min-w-0">
      {(description || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          {description && <p className="min-w-0 flex-1 basis-56 text-[13px] leading-5 text-ink-soft">{description}</p>}
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
