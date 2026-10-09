import { useEffect, useId, useState, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { IconCaretDown, type IconComponent } from "@/components/icons";

/**
 * A titled section that folds (docs/ux/REDESIGN_PROMPT.md §1, §6: "everything
 * used rarely is one tap away, not on the page"; "long forms are sections, not
 * one scroll"). Closed, it is one 56px row — icon, title, a one-line summary
 * of what is inside, an optional count — so a long page reads as a short list
 * and the merchant opens only what they came for.
 *
 * It is a pane like `Section` (the glass layer styles `[data-slot="card"]`),
 * and the open state is remembered for the browser tab under `persistKey`, so
 * coming back to an order or a product finds the page as it was left.
 *
 * The body is not mounted until first opened (pass `keepMounted` for a form
 * whose fields must survive a fold — an unsaved edit must never be lost by
 * closing a section).
 */
interface AccordionSectionProps {
  title: string;
  /** One line on the closed row: what is inside, in words or numbers («٣ شحنات · آخرها اتسلّمت»). */
  summary?: ReactNode;
  icon?: IconComponent;
  /** A small figure at the end of the row (a count, a status chip). */
  badge?: ReactNode;
  /** Controls on the title line that work without opening (a small button, a link). They do not toggle. */
  actions?: ReactNode;
  defaultOpen?: boolean;
  /** Controlled mode. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Remember open / closed for this browser tab: `"order:timeline"`. */
  persistKey?: string;
  /** Keep the body in the DOM while closed (forms). */
  keepMounted?: boolean;
  /** The element id of the section, for in-page links (`#shipments`) — opening when targeted. */
  id?: string;
  /** Drops the body's padding, for a table or a list that runs edge to edge. */
  flush?: boolean;
  children: ReactNode;
  className?: string;
}

const STORE = "zimos.accordion.v1";

function readStored(key: string | undefined): boolean | null {
  if (!key) return null;
  try {
    const map = JSON.parse(sessionStorage.getItem(STORE) ?? "{}") as Record<string, boolean>;
    return typeof map[key] === "boolean" ? map[key] : null;
  } catch {
    return null;
  }
}

function writeStored(key: string | undefined, open: boolean) {
  if (!key) return;
  try {
    const map = JSON.parse(sessionStorage.getItem(STORE) ?? "{}") as Record<string, boolean>;
    map[key] = open;
    sessionStorage.setItem(STORE, JSON.stringify(map));
  } catch {
    /* private mode — non-fatal */
  }
}

export function AccordionSection({
  title,
  summary,
  icon: Icon,
  badge,
  actions,
  defaultOpen = false,
  open: controlled,
  onOpenChange,
  persistKey,
  keepMounted = false,
  id,
  flush = false,
  children,
  className,
}: AccordionSectionProps) {
  const autoId = useId();
  const panelId = `${autoId}-panel`;
  const headingId = `${autoId}-title`;
  const [inner, setInner] = useState<boolean>(() => readStored(persistKey) ?? defaultOpen);
  const open = controlled ?? inner;
  function set(next: boolean) {
    if (controlled === undefined) setInner(next);
    writeStored(persistKey, next);
    onOpenChange?.(next);
  }

  // An in-page link (#id) opens the section it points at.
  useEffect(() => {
    if (!id) return;
    const openIfTargeted = () => {
      if (window.location.hash === `#${id}`) set(true);
    };
    openIfTargeted();
    window.addEventListener("hashchange", openIfTargeted);
    return () => window.removeEventListener("hashchange", openIfTargeted);
    // `set` only closes over stable setters and the keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <section
      id={id}
      data-slot="card"
      data-accordion=""
      data-open={open ? "" : undefined}
      aria-labelledby={headingId}
      className={cn(
        "zimos-accordion min-w-0 scroll-mt-24 rounded-[var(--radius-card)] bg-card text-card-foreground shadow-[var(--shadow-card)] ring-1 ring-line",
        className
      )}
    >
      <div className="flex min-h-14 items-center gap-2 ps-4 pe-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => set(!open)}
          className="group/acc flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[var(--radius-card)] text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {Icon && (
            <span className="zimos-accordion-chip flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon className="size-[18px]" weight={open ? "fill" : "regular"} aria-hidden />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span id={headingId} className="block truncate text-[15px] font-semibold text-ink">
              {title}
            </span>
            {summary && !open && <span className="block truncate text-[13px] text-ink-soft">{summary}</span>}
          </span>
          {badge && <span className="shrink-0">{badge}</span>}
          <IconCaretDown
            className={cn(
              "size-4 shrink-0 text-ink-soft transition-transform duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
              open && "rotate-180"
            )}
            weight="bold"
            aria-hidden
          />
        </button>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      {(open || keepMounted) && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headingId}
          hidden={!open}
          className={cn("zimos-accordion-body border-t border-line", flush ? "" : "px-4 pt-3 pb-4")}
        >
          {children}
        </div>
      )}
    </section>
  );
}

/** A column of accordion sections with the page's usual gap. */
export function AccordionGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-[var(--bento-gap)]", className)}>{children}</div>;
}
