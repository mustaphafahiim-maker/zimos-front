import type { ReactNode } from "react";
import type { Variant } from "@store-builder/api-client";
import type { ContextMenuItem } from "@/components/ContextMenu";
import type { VariantEdits } from "./useVariantEdits";

/** One variant as the grid and the phone cards draw it. */
export interface VariantRow {
  variant: Variant;
  /** Its options («المقاس: M · اللون: أحمر»), or «الافتراضي» when it has none. */
  name: string;
  /** «٣ مستنيين» beside the name, when shoppers wait for it to come back. */
  badge: ReactNode;
  /** «…» and the right-click menu: edit everything, archive / make active again. */
  menu: ContextMenuItem[];
  menuLabel: string;
}

export interface VariantListProps {
  rows: readonly VariantRow[];
  /** False for a product whose quantity is not counted: no stock to show or edit. */
  tracked: boolean;
  edits: VariantEdits;
}
