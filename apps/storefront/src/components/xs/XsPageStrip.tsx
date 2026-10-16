import { ChevronIcon } from "@/components/Icons";
import { StoreLink } from "@/components/StoreRoute";
import { xsBackground } from "@/lib/xsPicture";
import type { XsStorePages } from "@/lib/xsStorePages";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * The page-title strip of a store page on a store that wears a template
 * (lib/xsStorePages.ts): a tinted band with the title and the trail, the
 * look's picture band, or the trail alone. `title` is the page's heading
 * (an h1) when the strip holds it; a product keeps its own h1 and gives none.
 */
export function XsPageStrip({ pages, title, crumbs, label }: { pages: XsStorePages; title?: string; crumbs: Crumb[]; label: string }) {
  if (pages.strip === "none") return null;
  const trail = (
    // On the picture band it wears the title's class: the look's own title colour (app/xs-store.css).
    <nav aria-label={label} className={pages.strip === "title" ? "xs-crumbs__nav xs-title__heading" : "xs-crumbs__nav"}>
      <ol className="xs-crumbs__trail">
        {crumbs.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`} className="xs-crumbs__crumb">
            {i > 0 && <ChevronIcon size={13} className="xs-crumbs__sep" aria-hidden />}
            {crumb.href && i < crumbs.length - 1 ? (
              <StoreLink href={crumb.href} className="xs-crumbs__link">
                {crumb.label}
              </StoreLink>
            ) : (
              <span aria-current="page" className="xs-crumbs__here">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
  if (pages.strip === "inline") {
    return (
      <div className="xs-crumbs" data-variant="inline" data-xs-look={pages.look}>
        <div className="xs-crumbs__inner">{trail}</div>
      </div>
    );
  }
  if (pages.strip === "title") {
    return (
      <div className="xs-title xs-crumbs" data-variant="title" data-xs-look={pages.look} style={pages.image ? xsBackground(pages.image) : undefined}>
        {title ? <h1 className="xs-title__heading">{title}</h1> : null}
        {trail}
      </div>
    );
  }
  return (
    <div className="xs-crumbs" data-variant="band" data-xs-look={pages.look}>
      <div className="xs-crumbs__inner">
        {title ? <h1 className="xs-crumbs__title">{title}</h1> : null}
        {trail}
      </div>
    </div>
  );
}
