import type { ReactNode } from "react";
import { Section } from "@/components/Section";

interface CardFrameProps {
  /**
   * True when the card sits inside a folding section of the order page
   * (components/Accordion.tsx): the section is the pane and says the title, so
   * the card draws neither. Left out, the card is the `Section` it always was.
   */
  frameless?: boolean;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}

/**
 * `Section`, or just its inside. One pane per section: a card of the order
 * page that is shown in an `AccordionSection` would otherwise be a pane in a
 * pane, with its title said twice. The line under the title and the controls
 * of the title line are kept — they move to the top of the body.
 */
export function CardFrame({ frameless, title, description, actions, children, className, flush }: CardFrameProps) {
  if (!frameless) {
    return (
      <Section title={title} description={description} actions={actions} className={className} flush={flush}>
        {children}
      </Section>
    );
  }
  return (
    <div className="min-w-0">
      {(description || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {description ? <p className="min-w-0 flex-1 text-xs leading-5 text-ink-soft">{description}</p> : <span aria-hidden />}
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
