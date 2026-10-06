import { Package } from "lucide-react";
import { cn } from "@store-builder/ui";
import { orderLineImageOf, type OrderItem } from "@store-builder/api-client";

/**
 * An order line's product picture (SPEC §4.3 list, §4.4 card 1), or a box
 * with a package icon when the product has none. `label` names it for
 * screen readers and on hover where the name is not printed beside it.
 */
export function OrderLineThumb({ item, label, className }: { item: OrderItem; label?: string; className?: string }) {
  const image = orderLineImageOf(item);
  const box = cn("size-9 shrink-0 rounded-md border border-line", className);
  if (image) {
    return <img src={image} alt={label ?? ""} title={label} loading="lazy" className={cn(box, "bg-paper object-cover")} />;
  }
  return (
    <span
      title={label}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className={cn(box, "flex items-center justify-center bg-paper text-ink-soft")}
    >
      <Package className="size-4" aria-hidden />
    </span>
  );
}
