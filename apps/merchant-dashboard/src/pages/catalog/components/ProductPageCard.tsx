import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { Card, CardContent, cn } from "@store-builder/ui";
import { IconCaretDown, type IconComponent } from "@/components/icons";

/**
 * How a section of the product page is framed. One component, four frames, so
 * a section is written once and sits wherever the page puts it:
 *
 *  - `card` (the default, and what any other screen gets): its own card with a
 *    title and a description — the section standing alone.
 *  - `part`: a titled part inside a group of the product page. The group is
 *    the pane, so the part has no frame of its own; parts are told apart by a
 *    hairline.
 *  - `solo`: the only part of its group. The group's title already names it,
 *    so only the description is said.
 *  - `fold`: one slim row that opens in place — the read-only notes under the
 *    variants (sale, price history, stock by location, forecast, lots).
 */
export type ProductCardFrame = "card" | "part" | "solo" | "fold";

const FrameContext = createContext<ProductCardFrame>("card");

export function ProductCardFrameProvider({ frame, children }: { frame: ProductCardFrame; children: ReactNode }) {
  return <FrameContext.Provider value={frame}>{children}</FrameContext.Provider>;
}

/** The frame the surrounding page asked for; `card` anywhere else. */
export function useProductCardFrame(): ProductCardFrame {
  return useContext(FrameContext);
}

/** A part inside a group: no frame, a hairline above every part but the first. */
export const PRODUCT_PART =
  "zimos-product-part min-w-0 border-t border-line pt-5 mt-5 first:mt-0 first:border-t-0 first:pt-0";

interface ProductPageCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Drawn on a folded row, and beside the title of a card. */
  icon?: IconComponent;
  /** After the title: a count, a state chip. */
  badge?: ReactNode;
  /** At the end of the title line: the section's one button or link. */
  actions?: ReactNode;
  /** `fold` only: the row was opened for the first time (load what it shows). */
  onOpen?: () => void;
  id?: string;
  className?: string;
}

/**
 * The frame of a product-page section: the same title, description and
 * padding for every section, in the frame the page asked for (see
 * `ProductCardFrame`).
 */
export function ProductPageCard({ title, description, children, icon: Icon, badge, actions, onOpen, id, className }: ProductPageCardProps) {
  const frame = useProductCardFrame();
  const headingId = useId();

  if (frame === "fold") {
    return (
      <FoldRow title={title} description={description} icon={Icon} badge={badge} onOpen={onOpen} id={id} className={className}>
        {children}
      </FoldRow>
    );
  }

  if (frame === "part" || frame === "solo") {
    const head = frame === "part" || Boolean(description) || Boolean(actions);
    return (
      <section id={id} aria-labelledby={frame === "part" ? headingId : undefined} aria-label={frame === "solo" ? title : undefined} className={cn(PRODUCT_PART, className)}>
        {head && (
          <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div className="min-w-0 flex-1 basis-56">
              {frame === "part" && (
                <h3 id={headingId} className="text-[15px] leading-6 font-semibold text-ink">
                  {title}
                  {badge && <span className="ms-2 align-middle">{badge}</span>}
                </h3>
              )}
              {description && <p className="text-[13px] leading-5 text-ink-soft">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
          </div>
        )}
        {children}
      </section>
    );
  }

  return (
    <Card id={id} className={className}>
      <CardContent className="pt-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0 flex-1 basis-56">
            <h2 className="font-display text-lg font-medium text-ink">
              {title}
              {badge && <span className="ms-2 align-middle">{badge}</span>}
            </h2>
            {description && <p className="text-sm text-ink-soft">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * A slim row that opens in place. Closed, it is 48px: an icon, the title and
 * one line of what is inside. The body is mounted the first time the row is
 * opened and kept after that, so opening it twice reads nothing twice.
 */
function FoldRow({
  title,
  description,
  icon: Icon,
  badge,
  onOpen,
  id,
  className,
  children,
}: {
  title: string;
  description?: string;
  icon?: IconComponent;
  badge?: ReactNode;
  onOpen?: () => void;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const panelId = useId();

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !seen) {
      setSeen(true);
      onOpen?.();
    }
  }

  return (
    <div id={id} data-slot="product-fold" data-open={open ? "" : undefined} className={cn("zimos-product-fold min-w-0 border-t border-line first:border-t-0", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="flex min-h-12 w-full cursor-pointer items-center gap-3 px-3.5 py-2 text-start transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        {Icon && <Icon className="size-[18px] shrink-0 text-ink-soft" aria-hidden />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-5 font-medium text-ink">{title}</span>
          {description && !open && <span className="block truncate text-xs leading-4 text-ink-soft">{description}</span>}
        </span>
        {badge && <span className="shrink-0">{badge}</span>}
        <IconCaretDown
          className={cn(
            "size-4 shrink-0 text-ink-soft transition-transform duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {seen && (
        <div id={panelId} role="region" aria-label={title} hidden={!open} className="px-3.5 pt-1 pb-4">
          {description && <p className="mb-3 text-[13px] leading-5 text-ink-soft">{description}</p>}
          {children}
        </div>
      )}
    </div>
  );
}
