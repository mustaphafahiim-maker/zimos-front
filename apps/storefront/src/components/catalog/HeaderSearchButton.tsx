"use client";

import { useRouter } from "next/navigation";
import { SearchIcon } from "@/components/Icons";
import { iconBtn } from "@/components/ui";
import { useStore } from "@/lib/StoreContext";
import { FOCUS_SEARCH_FLAG, SEARCH_INPUT_ID } from "./CatalogSearch";

/** Focuses the catalogue search on this page, or opens the store home's search. */
export function HeaderSearchButton({ workspaceId }: { workspaceId: string }) {
  const { t } = useStore();
  const router = useRouter();

  function open() {
    const el = document.getElementById(SEARCH_INPUT_ID) as HTMLInputElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
      return;
    }
    try {
      window.sessionStorage.setItem(FOCUS_SEARCH_FLAG, "1");
    } catch {
      /* ignore */
    }
    // `search=1` shows the catalogue even when the merchant published a home page.
    router.push(`/store/${workspaceId}?search=1#products`);
  }

  return (
    <button type="button" onClick={open} aria-label={t.browse.search} className={iconBtn}>
      <SearchIcon />
    </button>
  );
}
