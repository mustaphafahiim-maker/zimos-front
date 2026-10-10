import { createContext, useContext } from "react";
import type { GroupKey } from "./groups";

/** Which group of the product page a section sits in, and how to bring that group to the reader. */
export interface ProductGroupValue {
  group: GroupKey;
  /** Opens the group if it is folded (phone) and scrolls to it. */
  reveal: () => void;
}

export const ProductGroupContext = createContext<ProductGroupValue | null>(null);

/** Null outside the product page: a section then stands on its own. */
export function useProductGroup(): ProductGroupValue | null {
  return useContext(ProductGroupContext);
}
