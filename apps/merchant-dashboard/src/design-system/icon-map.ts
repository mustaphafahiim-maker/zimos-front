import { IconError, IconGridView, IconHexagon, IconLayers, IconOrders, IconTheme } from "@/components/icons";
import { NAV_GROUPS } from "@/lib/navigation";

// Do not duplicate commerce icon meanings. The existing product navigation
// registry is authoritative; this map only adds the lab's section names.
export const LAB_NAV = [
  { id: "brand", icon: IconHexagon },
  { id: "orders", icon: IconOrders },
  { id: "foundation", icon: IconTheme },
  { id: "components", icon: IconGridView },
  { id: "material", icon: IconLayers },
  { id: "states", icon: IconError },
] as const;
export const COMMERCE_ICONS = NAV_GROUPS.flatMap((group) => group.items).slice(
  0,
  12,
);
