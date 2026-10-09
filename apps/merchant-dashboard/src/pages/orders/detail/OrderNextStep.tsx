import { Button, cn } from "@store-builder/ui";
import { IconExternal, IconSpinner } from "@/components/icons";
import type { NextStepAction } from "./useOrderNextStep";

/**
 * The order's one next step as a button: 48px, the brand fill (the glass
 * layer adds the sheen — glass/order-page.css, `.zimos-order-next`). Drawn
 * twice from the same action: in the hero from md up, and in the bar above
 * the dock on a phone, so both show the same word, the same busy state.
 */
export function NextStepButton({ action, className }: { action: NextStepAction; className?: string }) {
  const Icon = action.icon;
  const look = cn("zimos-order-next h-12 min-h-12 gap-2 rounded-full px-6 text-[15px]", className);
  const inside = (
    <>
      {action.busy ? (
        <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
      ) : (
        <Icon className="size-4" weight="bold" aria-hidden />
      )}
      <span className="truncate">{action.label}</span>
      {/* It leaves for the courier's page: say so before the tap. */}
      {action.href && <IconExternal className="size-4 opacity-80 rtl:-scale-x-100" aria-hidden />}
    </>
  );

  if (action.href) {
    return (
      <Button asChild className={look}>
        <a href={action.href} target="_blank" rel="noreferrer">
          {inside}
        </a>
      </Button>
    );
  }
  return (
    <Button type="button" className={look} onClick={action.onClick} disabled={action.disabled} aria-busy={action.busy || undefined}>
      {inside}
    </Button>
  );
}
