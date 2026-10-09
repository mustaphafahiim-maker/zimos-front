import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { IconContext } from "@/components/icons";

type EmptyStateTone = "default" | "success" | "attention";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  /**
   * The tint of the icon tile: the store's colour (default), green for
   * "all done, nothing waiting", amber for "this needs setting up first".
   */
  tone?: EmptyStateTone;
}

// Every caller's <IconX /> is drawn in two tones here, without touching the callers.
const DUOTONE = { weight: "duotone" } as const;

// The tile on its own (glass off): the soft token fills. glass/states.css lays a gradient tint over it.
const TILE_TONE: Record<EmptyStateTone, string> = {
  default: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  attention: "bg-accent-soft text-accent-dark",
};

/**
 * What a page shows when it has nothing yet: what the page is for, and the one
 * action that fills it. A pane, a 72px tile with the icon in two tones, the
 * title, a sentence, the action.
 *
 * The pane is solid with a dashed outline on its own; under the glass layer
 * (glass/states.css, `[data-slot="empty-state"]`) it becomes a glass pane and
 * the dashes go.
 */
export function EmptyState({ title, description, action, icon, className, tone = "default" }: EmptyStateProps) {
  return (
    // The block settles in with the page's own 220 ms fade-and-rise (the `page-in`
    // keyframes of index.css), and is still under prefers-reduced-motion. It names
    // the keyframes rather than wearing the `.page-in` class: during a view
    // transition that class also names the element `page`, and two elements with
    // one view-transition-name cancel the whole transition. While a transition
    // runs (<html data-vt>) the page itself is moving, so the block stays put.
    <div
      data-slot="empty-state"
      data-tone={tone}
      className={cn(
        "flex animate-[page-in_220ms_var(--ease-out)_backwards] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-line bg-paper-raised px-6 py-12 text-center motion-reduce:animate-none [html[data-vt]_&]:animate-none",
        className
      )}
    >
      {icon && (
        <div
          data-slot="empty-state-tile"
          data-tone={tone}
          className={cn("mb-5 flex size-18 shrink-0 items-center justify-center rounded-[1.5rem] [&_svg]:size-10", TILE_TONE[tone])}
        >
          <IconContext.Provider value={DUOTONE}>{icon}</IconContext.Provider>
        </div>
      )}
      {/* The text keeps its own box: index.css treats `.page-in > [class*="max-w-"]` as the
          page column (centred, and widened in full screen), and the description's max-w-md
          must never be caught by that, whatever class a caller adds to this block. */}
      <div className="flex flex-col items-center">
        <h3 className="text-base font-semibold text-ink sm:text-[17px]">{title}</h3>
        {description && (
          <p data-slot="empty-state-description" className="mt-1.5 max-w-md text-sm leading-6 text-ink-soft">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-6 [&_a]:min-h-11 [&_button]:min-h-11">{action}</div>}
    </div>
  );
}
