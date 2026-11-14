import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";

export type ProductFlagTone = "danger" | "attention" | "info";

// The chip on its own (glass off): the soft token fills. Under the glass layer it takes the tinted
// pane every list's small chips share (`.zimos-order-flag`, glass/orders.css), so a flag beside a
// product reads exactly like one beside an order.
const TONE: Record<ProductFlagTone, string> = {
  danger: "bg-danger-soft text-danger",
  attention: "bg-accent-soft text-accent-dark",
  info: "bg-primary-soft text-primary-dark dark:text-primary",
};

/**
 * A small chip beside a product: sold out, no weight, taking pre-orders. The
 * word carries the meaning; the colour only helps.
 */
export function ProductFlag({
  tone,
  title,
  className,
  children,
}: {
  tone: ProductFlagTone;
  /** Why, on hover. */
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      data-tone={tone}
      title={title}
      className={cn(
        "zimos-order-flag inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] leading-none font-semibold whitespace-nowrap",
        TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
