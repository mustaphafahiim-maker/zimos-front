import { Link } from "react-router-dom";
import { IconFolder, IconListView, IconSizeCharts, IconSynonyms, type IconComponent } from "@/components/icons";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { NAV_LABELS } from "@/lib/navigation";
import { SPEC_STRINGS } from "@/pages/productSpecs/specStrings";

const STRINGS = {
  en: { collections: "Collections" },
  ar: { collections: "المجموعات" },
} satisfies Messages;

export interface ProductToolLink {
  id: "collections" | "specifications" | "sizeCharts" | "searchSynonyms";
  to: string;
  label: string;
  icon: IconComponent;
}

/**
 * The occasional screens that sit under Products without a sidebar line of
 * their own: collections, specifications (handoff 231), size charts (210) and
 * search synonyms (211). The products list keeps them one tap away, in its
 * «أدوات» menu (list/CatalogHeaderTools.tsx); the labels are the ones ⌘K and
 * the breadcrumb use.
 */
export function useProductToolLinks(): ProductToolLink[] {
  const t = useT(STRINGS);
  const nav = useT(NAV_LABELS);
  const specs = useT(SPEC_STRINGS);
  return [
    { id: "collections", to: "/catalog/collections", label: t.collections, icon: IconFolder },
    { id: "specifications", to: "/catalog/specifications", label: specs.title, icon: IconListView },
    { id: "sizeCharts", to: "/size-charts", label: nav.sizeCharts, icon: IconSizeCharts },
    { id: "searchSynonyms", to: "/search-synonyms", label: nav.searchSynonyms, icon: IconSynonyms },
  ];
}

const LINK = "inline-flex min-h-11 items-center text-sm font-medium text-primary-dark hover:underline";

/** The same four as plain links in a row, for a page that wants them inline. */
export function ProductToolLinks() {
  const links = useProductToolLinks();
  return (
    <>
      {links.map((link) => (
        <Link key={link.id} to={link.to} className={LINK}>
          {link.label}
        </Link>
      ))}
    </>
  );
}
