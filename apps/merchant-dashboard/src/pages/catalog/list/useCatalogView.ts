import { useCallback, useState } from "react";

/** The products as rows (a table, cards on a phone) or as a grid of photos. */
export type CatalogView = "list" | "grid";

/** The key the list has always kept its shape under, so a merchant's choice survives the redesign. */
const VIEW_KEY = "sb.catalogView";

function readView(): CatalogView {
  try {
    return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

/** The shape of the list, remembered per browser. */
export function useCatalogView(): [CatalogView, (next: CatalogView) => void] {
  const [view, setViewState] = useState<CatalogView>(readView);
  const setView = useCallback((next: CatalogView) => {
    setViewState(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* private mode: the choice lasts for this visit */
    }
  }, []);
  return [view, setView];
}
