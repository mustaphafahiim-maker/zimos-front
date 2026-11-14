import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { AccordionSection } from "@/components/Accordion";
import type { IconComponent } from "@/components/icons";
import { Section } from "@/components/Section";

/** What a card of the customer page hands to whatever draws its frame. */
export interface CustomerCardParts {
  title: string;
  description?: string;
  /** Controls of the title line: a button, a link. */
  actions?: ReactNode;
  /** One line that says what is inside, from what the card has already loaded («رصيد ١٥٠ ج.م»). */
  summary?: ReactNode;
  /** A small figure at the end of a folded row: a count, a status chip. */
  badge?: ReactNode;
  /** The body runs edge to edge (a table, a ledger). */
  flush?: boolean;
  children: ReactNode;
}

/**
 * Draws a card's frame in its place. The customer page passes one per card so
 * the card sits in a folding section instead of a pane of its own; left out,
 * the card is the `Section` it always was.
 */
export type CustomerCardFrame = (parts: CustomerCardParts) => ReactNode;

/**
 * The frame of a self-loading card of the customer page: `Section` by default,
 * or whatever `frame` draws. A card that has nothing to show still returns
 * null before it gets here, so its section is not on the page either.
 */
export function CustomerCard({ frame, ...parts }: CustomerCardParts & { frame?: CustomerCardFrame }) {
  if (frame) return <>{frame(parts)}</>;
  return (
    <Section title={parts.title} description={parts.description} actions={parts.actions} flush={parts.flush}>
      {parts.children}
    </Section>
  );
}

export interface FoldOptions {
  /** The section's name in the tab's memory: `customer:<key>`. */
  key: string;
  icon: IconComponent;
  /** Said instead of the card's own title. */
  title?: string;
  /** The folded line when the card gives none (it falls back to the card's description). */
  summary?: ReactNode;
  /** Keep the body in the page while folded: a form whose half-typed edit must survive a fold. */
  keepMounted?: boolean;
  defaultOpen?: boolean;
  /** Where the section sits in the page's order (`order-*`). */
  className?: string;
  id?: string;
}

/**
 * A frame that folds: the card becomes one 56px row — icon, title, the line
 * that says what is inside — and opens in place. The card's description and
 * the controls of its title line move to the top of the body.
 */
export function foldingFrame(options: FoldOptions): CustomerCardFrame {
  return (parts) => <FoldedCard options={options} parts={parts} />;
}

function FoldedCard({ options, parts }: { options: FoldOptions; parts: CustomerCardParts }) {
  const head = Boolean(parts.description || parts.actions);
  return (
    <AccordionSection
      id={options.id}
      className={options.className}
      title={options.title ?? parts.title}
      icon={options.icon}
      summary={parts.summary ?? options.summary ?? parts.description}
      badge={parts.badge}
      persistKey={`customer:${options.key}`}
      keepMounted={options.keepMounted}
      defaultOpen={options.defaultOpen}
      flush={parts.flush}
    >
      {/* A flush body reaches the section's rounded foot: it is clipped to it, as `Section` clips its own. */}
      <div className={cn("min-w-0", parts.flush && "overflow-hidden rounded-b-[var(--radius-card)] pt-3")}>
        {head && (
          <div className={cn("mb-3 flex flex-wrap items-center justify-between gap-2", parts.flush && "px-4")}>
            {parts.description ? (
              <p className="min-w-0 flex-1 basis-48 text-xs leading-5 text-ink-soft">{parts.description}</p>
            ) : (
              <span aria-hidden />
            )}
            {parts.actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{parts.actions}</div>}
          </div>
        )}
        {parts.children}
      </div>
    </AccordionSection>
  );
}
