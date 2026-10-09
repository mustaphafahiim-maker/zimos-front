import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { IconCaretRight, type IconComponent } from "@/components/icons";

export type InsightTone = "brand" | "attention" | "danger";

// The glyph on its own (glass off): the soft token fills. glass/catalog.css tints the whole chip a little.
const GLYPH: Record<InsightTone, string> = {
  brand: "bg-primary-soft text-primary-dark dark:text-primary",
  attention: "bg-accent-soft text-accent-dark",
  danger: "bg-danger-soft text-danger",
};

/**
 * One chip of the slim row over the products list: something the store's
 * shoppers are telling the merchant («٣ منتجات الناس مستنياها ترجع», «الأكتر في
 * المفضلة»). Pressing it opens the full answer in a sheet. A pill 40px tall
 * with a mouse, 44px under a finger.
 */
export function InsightChip({
  icon: ChipIcon,
  tone,
  onClick,
  children,
  opens = true,
}: {
  icon: IconComponent;
  tone: InsightTone;
  onClick: () => void;
  children: ReactNode;
  /** It opens a sheet (a caret says so); false for a chip that only retries. */
  opens?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup={opens ? "dialog" : undefined}
      data-slot="catalog-insight"
      data-tone={tone}
      className="zimos-catalog-insight inline-flex h-10 max-w-full shrink-0 cursor-pointer items-center gap-2 rounded-full bg-paper-raised ps-1.5 pe-3 text-[13px] leading-5 font-medium text-ink ring-1 ring-line transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] select-none hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 pointer-coarse:h-11"
    >
      <span aria-hidden className={cn("zimos-catalog-insight-glyph flex size-7 shrink-0 items-center justify-center rounded-full", GLYPH[tone])}>
        <ChipIcon className="size-4" weight="fill" />
      </span>
      <span className="min-w-0 truncate">{children}</span>
      {opens && <IconCaretRight className="size-3.5 shrink-0 text-ink-soft rtl:rotate-180" aria-hidden />}
    </button>
  );
}
