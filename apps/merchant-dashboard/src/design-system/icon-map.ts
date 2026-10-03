import {
  LayoutGrid,
  Layers,
  Palette,
  ShoppingBag,
  CircleAlert,
} from "lucide-react";
import { NAV_GROUPS } from "@/lib/navigation";

// Do not duplicate commerce icon meanings. The existing product navigation
// registry is authoritative; this map only adds the lab's section names.
export const LAB_NAV = [
  { id: "orders", icon: ShoppingBag },
  { id: "foundation", icon: Palette },
  { id: "components", icon: LayoutGrid },
  { id: "material", icon: Layers },
  { id: "states", icon: CircleAlert },
] as const;
export const COMMERCE_ICONS = NAV_GROUPS.flatMap((group) => group.items).slice(
  0,
  12,
);
