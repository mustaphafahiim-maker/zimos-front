import { storefrontDesignMeta } from "@store-builder/api-client";
import type { Dictionary } from "./i18n";
import type { ResolvedShellLink } from "./storeShell";

/**
 * The link columns every store footer adds after the merchant's own groups
 * (SPEC §8.3): the pages flagged "show in footer" and the legal policies the
 * store has written, each as its own column. Both footer layouts use these —
 * the plain one and the rich one (shell/RichFooter) — so a store does not lose
 * its policy links by picking a different footer.
 */
export function pageAndPolicyGroups(store: unknown, t: Dictionary): Array<{ title: string; links: ResolvedShellLink[] }> {
  const design = storefrontDesignMeta(store);
  const groups: Array<{ title: string; links: ResolvedShellLink[] }> = [];
  const footerPages = design.navPages.filter((p) => p.showInFooter);
  if (footerPages.length > 0) {
    groups.push({
      title: t.footer.pages,
      links: footerPages.map((p) => ({ key: `page:${p.path}`, label: p.title, href: p.path, external: false })),
    });
  }
  if (design.legal.length > 0) {
    groups.push({
      title: t.policies.title,
      links: design.legal.map((key) => ({
        key: `policy:${key}`,
        label: t.policies[key],
        href: `/policies/${key.replace(/_/g, "-")}`,
        external: false,
      })),
    });
  }
  return groups;
}
