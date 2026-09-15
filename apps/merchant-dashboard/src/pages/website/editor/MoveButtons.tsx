import { ArrowDown, ArrowUp } from "lucide-react";

const BUTTON_CLASS =
  "cursor-pointer rounded-[0.375rem] p-1 text-ink-soft transition-colors hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

/**
 * Up / down buttons for reordering a section or an element — the plain-click
 * (and plain-keyboard) alternative to dragging. Disabled at either end.
 */
export function MoveButtons({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  upLabel,
  downLabel,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  upLabel: string;
  downLabel: string;
}) {
  return (
    <span className="flex shrink-0 items-center gap-0.5 normal-case tracking-normal">
      <button
        type="button"
        onClick={onMoveUp}
        disabled={!canMoveUp}
        aria-label={upLabel}
        title={upLabel}
        className={BUTTON_CLASS}
      >
        <ArrowUp className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        aria-label={downLabel}
        title={downLabel}
        className={BUTTON_CLASS}
      >
        <ArrowDown className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}
