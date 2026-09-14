/**
 * Lightweight stand-ins for what the storefront wraps around PageRenderer:
 * header (announcement, logo, nav), footer, and the commerce slots. Everything
 * is styled with the store's own `--zr-*` variables inside the preview iframe
 * (no Tailwind there) and nothing navigates or submits.
 */
import type { ReactNode } from "react";
import type { CollectionSummary, Product } from "@store-builder/api-client";
import {
  PageRenderer,
  RESERVED_THEME_PATHS,
  paymentBadgeList,
  type CollectionListQuery,
  type EditorBridge,
  type ProductGridQuery,
  type ProductRef,
  type RenderContext,
  type RendererLocale,
  type ThemeSettings,
  type Tree,
} from "@store-builder/store-renderer";
import { formatMoney } from "@/lib/format";
import { pageDisplayName } from "./elementLibrary";

export const PREVIEW_CSS = `
html,body{margin:0;padding:0;background:var(--zr-bg,#fff)}
body{min-height:100vh}
.zb-root{min-height:100vh;display:flex;flex-direction:column;background:var(--zr-bg);color:var(--zr-text)}
.zb-header{position:relative;z-index:5;background:var(--zr-bg);border-bottom:1px solid var(--zr-border)}
.zb-header--sticky{position:sticky;top:0}
.zb-header__inner{max-width:72rem;margin-inline:auto;padding:.6rem 1rem;display:flex;align-items:center;gap:1rem;min-height:4rem}
.zb-header--center .zb-header__inner{display:grid;grid-template-columns:1fr auto 1fr}
.zb-header--center .zb-logo{justify-self:center}
.zb-logo{display:flex;align-items:center;gap:.6rem;font-weight:800;font-size:1.125rem;color:var(--zr-text);min-width:0}
.zb-logo__name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.zb-logo__mark{width:2.5rem;height:2.5rem;border-radius:var(--zr-radius);background:var(--zr-primary);color:var(--zr-on-primary);display:grid;place-items:center;font-weight:800;flex-shrink:0;overflow:hidden}
.zb-logo__mark img{width:100%;height:100%;object-fit:contain;background:var(--zr-bg)}
.zb-nav{display:flex;gap:.15rem;flex:1;justify-content:center;overflow:hidden}
.zb-nav span{padding:.5rem .7rem;border-radius:var(--zr-radius-sm);font-size:.875rem;font-weight:600;color:var(--zr-text-soft);white-space:nowrap}
.zb-actions{display:flex;gap:.5rem;align-items:center;justify-content:flex-end;margin-inline-start:auto}
.zb-iconbtn{width:2.5rem;height:2.5rem;border-radius:999px;border:1px solid var(--zr-border);display:grid;place-items:center;color:var(--zr-text)}
.zb-menu{display:none}
@media (max-width:1023.98px){.zb-nav{display:none}.zb-menu{display:grid}}
.zb-main{flex:1;display:flex;flex-direction:column}
.zb-footer{margin-top:auto;border-top:1px solid var(--zr-border);background:var(--zr-surface)}
.zb-footer__grid{max-width:72rem;margin-inline:auto;padding:2.5rem 1rem;display:grid;gap:2rem;grid-template-columns:1fr}
@media (min-width:640px){.zb-footer__grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (min-width:1024px){.zb-footer--c3 .zb-footer__grid{grid-template-columns:1.5fr 1fr 1fr}.zb-footer--c4 .zb-footer__grid{grid-template-columns:1.5fr 1fr 1fr 1fr}}
.zb-footer h4{margin:0 0 .6rem;font-size:.875rem;font-weight:700;color:var(--zr-text)}
.zb-footer p,.zb-footer li{font-size:.875rem;color:var(--zr-text-soft);margin:0;line-height:1.7}
.zb-footer ul{list-style:none;margin:0;padding:0;display:grid;gap:.35rem}
.zb-footer__name{font-size:1.125rem!important;font-weight:800;color:var(--zr-text)!important;margin-bottom:.4rem!important}
.zb-social{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1rem}
.zb-social span{border:1px solid var(--zr-border);border-radius:999px;padding:.3rem .8rem;font-size:.8rem;color:var(--zr-text-soft)}
.zb-footer__bar{border-top:1px solid var(--zr-border)}
.zb-footer__bar>div{max-width:72rem;margin-inline:auto;padding:1rem;display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;justify-content:space-between;font-size:.75rem;color:var(--zr-muted)}
.zb-badges{display:flex;gap:.4rem;flex-wrap:wrap}
.zb-badges span{border:1px solid var(--zr-border);background:var(--zr-bg);border-radius:6px;padding:.2rem .6rem;font-weight:600;color:var(--zr-text-soft)}
.zb-block-title{margin:0 0 1.25rem;font-size:1.5rem;font-weight:700;color:var(--zr-fg)}
.zb-grid{display:grid;gap:var(--zr-gap,1.5rem);grid-template-columns:repeat(2,minmax(0,1fr))}
@media (min-width:768px){.zb-grid{grid-template-columns:repeat(var(--zb-cols-md,3),minmax(0,1fr))}}
@media (min-width:1024px){.zb-grid{grid-template-columns:repeat(var(--zb-cols,4),minmax(0,1fr))}}
.zb-card{display:flex;flex-direction:column;border:1px solid var(--zr-border);border-radius:var(--zr-radius-lg);overflow:hidden;background:var(--zr-bg);color:var(--zr-text);text-align:start}
.zb-card__media{aspect-ratio:var(--zr-card-ratio,1 / 1);background:var(--zr-surface);display:grid;place-items:center;color:var(--zr-muted);overflow:hidden}
.zb-card__media img{width:100%;height:100%;object-fit:cover;display:block}
.zb-card__body{padding:.75rem;display:grid;gap:.4rem}
.zb-card__name{font-weight:700;font-size:.95rem;margin:0;line-height:1.35}
.zb-price{display:flex;gap:.5rem;align-items:baseline;flex-wrap:wrap;margin:0}
.zb-price strong{font-size:1rem}
.zb-price s{font-size:.8rem;color:var(--zr-muted)}
.zb-btn{display:inline-flex;align-items:center;justify-content:center;min-height:2.5rem;padding:.5rem 1rem;border-radius:var(--zr-btn-radius);background:var(--zr-primary);color:var(--zr-on-primary);font-weight:700;font-size:.875rem;width:100%;box-sizing:border-box}
.zb-btn--ghost{background:transparent;color:var(--zr-primary);border:1.5px solid currentColor}
.zb-spot{display:grid;gap:1.5rem;border:1px solid var(--zr-border);border-radius:var(--zr-radius-lg);padding:1.25rem;background:var(--zr-bg);color:var(--zr-text)}
@media (min-width:640px){.zb-spot{grid-template-columns:1fr 1fr}}
.zb-spot h3{margin:0;font-size:1.4rem;font-weight:800}
.zb-spot p{margin:0}
.zb-stack{display:grid;gap:.75rem;align-content:start}
.zb-field{display:grid;gap:.3rem;font-size:.85rem;font-weight:600}
.zb-input{min-height:2.75rem;border:1px solid var(--zr-border);border-radius:var(--zr-radius-sm);background:var(--zr-bg)}
.zb-note{font-size:.75rem;color:var(--zr-muted);margin:0}
.zb-cart{border:1px solid var(--zr-border);border-radius:var(--zr-radius-lg);padding:1.25rem;display:grid;gap:.75rem;background:var(--zr-bg);color:var(--zr-text)}
.zb-cart__row{display:flex;justify-content:space-between;font-size:.9rem}
.zb-coll{border-radius:var(--zr-radius-lg);overflow:hidden;aspect-ratio:4 / 3;background:linear-gradient(135deg,var(--zr-primary),var(--zr-primary-deep));color:var(--zr-on-primary);display:flex;align-items:flex-end;padding:1rem;font-weight:800}
.zb-empty{border:1.5px dashed var(--zr-border);border-radius:var(--zr-radius);padding:1.25rem;text-align:center;color:var(--zr-muted);font-size:.875rem}
.zr-inline:focus{white-space:pre-wrap}
`;

const TEXT = {
  ar: {
    home: "الرئيسية",
    allProducts: "كل المنتجات",
    track: "تتبع طلبك",
    shop: "تسوّق",
    help: "مساعدة",
    myOrders: "طلباتي",
    cart: "السلة",
    contact: "تواصل",
    cod: "الدفع عند الاستلام",
    rights: "© {year} {name}. كل الحقوق محفوظة.",
    orderNow: "اطلب الآن",
    addToCart: "ضيف للسلة",
    name: "الاسم",
    phone: "رقم الموبايل",
    address: "العنوان بالتفصيل",
    confirm: "أكّد الطلب",
    formNote: "معاينة — الفورم مش بيبعت طلبات من المحرر.",
    noProducts: "ضيف منتجات من الكتالوج علشان تظهر هنا.",
    noCollections: "ضيف أقسام من الكتالوج علشان تظهر هنا.",
    subtotal: "الإجمالي",
    cartNote: "سلة العميل هتظهر هنا.",
    quick: "اطلب بسرعة",
    product: "منتج",
  },
  en: {
    home: "Home",
    allProducts: "All products",
    track: "Track order",
    shop: "Shop",
    help: "Help",
    myOrders: "My orders",
    cart: "Cart",
    contact: "Contact",
    cod: "Cash on delivery",
    rights: "© {year} {name}. All rights reserved.",
    orderNow: "Order now",
    addToCart: "Add to cart",
    name: "Name",
    phone: "Phone",
    address: "Full address",
    confirm: "Confirm order",
    formNote: "Preview — the form doesn't send orders from the builder.",
    noProducts: "Add products in your catalog to show them here.",
    noCollections: "Add collections in your catalog to show them here.",
    subtotal: "Subtotal",
    cartNote: "The shopper's cart shows here.",
    quick: "Quick order",
    product: "Product",
  },
} as const;

export interface CatalogData {
  products: Product[];
  collections: CollectionSummary[];
  currency: string;
}

export const EMPTY_CATALOG: CatalogData = { products: [], collections: [], currency: "EGP" };

function Svg({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
const SEARCH = "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3";
const BAG = "M6 7h12l1 14H5L6 7Zm3 0a3 3 0 0 1 6 0";
const MENU = "M4 7h16M4 12h16M4 17h16";
const BOX = "M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8";

export function StoreHeaderPreview({
  theme,
  storeName,
  logoUrl,
  locale,
  pages,
}: {
  theme: ThemeSettings;
  storeName: string;
  logoUrl?: string | null;
  locale: RendererLocale;
  pages: Array<{ title: string; path: string }>;
}) {
  const tx = TEXT[locale];
  const ann = theme.header.announcement;
  const extra = pages.filter((p) => p.path !== "/" && !RESERVED_THEME_PATHS.includes(p.path)).slice(0, 3);
  return (
    <>
      {ann.enabled && ann.text && (
        <div className="zr-announce">
          <div className="zr-announce__inner">
            <p style={{ margin: 0 }}>{ann.text}</p>
          </div>
        </div>
      )}
      <header className={`zb-header${theme.header.sticky ? " zb-header--sticky" : ""}${theme.header.layout === "logo-center" ? " zb-header--center" : ""}`}>
        <div className="zb-header__inner">
          {theme.header.layout === "logo-center" && (
            <span className="zb-iconbtn zb-menu" style={{ display: "grid" }}>
              <Svg d={MENU} />
            </span>
          )}
          <span className="zb-logo">
            <span className="zb-logo__mark">{logoUrl ? <img src={logoUrl} alt="" /> : storeName.trim().charAt(0).toUpperCase() || "Z"}</span>
            <span className="zb-logo__name">{storeName}</span>
          </span>
          {theme.header.layout !== "logo-center" && (
            <nav className="zb-nav">
              <span>{tx.home}</span>
              <span>{tx.allProducts}</span>
              {extra.map((p) => (
                <span key={p.path}>{pageDisplayName(p, locale)}</span>
              ))}
              <span>{tx.track}</span>
            </nav>
          )}
          <span className="zb-actions">
            {theme.header.showSearch && (
              <span className="zb-iconbtn">
                <Svg d={SEARCH} />
              </span>
            )}
            <span className="zb-iconbtn">
              <Svg d={BAG} />
            </span>
            {theme.header.layout !== "logo-center" && (
              <span className="zb-iconbtn zb-menu">
                <Svg d={MENU} />
              </span>
            )}
          </span>
        </div>
      </header>
    </>
  );
}

export function StoreFooterPreview({ theme, storeName, locale }: { theme: ThemeSettings; storeName: string; locale: RendererLocale }) {
  const tx = TEXT[locale];
  const cols = theme.footer.columns;
  const badges = paymentBadgeList(theme);
  const social = theme.footer.showSocial ? theme.footer.social : [];
  return (
    <footer className={`zb-footer zb-footer--c${cols}`}>
      <div className="zb-footer__grid">
        <div>
          <p className="zb-footer__name">{storeName}</p>
          {theme.footer.about && <p>{theme.footer.about}</p>}
          {social.length > 0 && (
            <div className="zb-social">
              {social.map((s) => (
                <span key={s.url}>{s.platform || s.url}</span>
              ))}
            </div>
          )}
        </div>
        {cols >= 3 && (
          <div>
            <h4>{tx.shop}</h4>
            <ul>
              <li>{tx.allProducts}</li>
            </ul>
          </div>
        )}
        <div>
          <h4>{tx.help}</h4>
          <ul>
            <li>{tx.track}</li>
            <li>{tx.myOrders}</li>
            <li>{tx.cart}</li>
          </ul>
        </div>
        {cols >= 4 && (
          <div>
            <h4>{tx.contact}</h4>
            <ul>
              <li>{tx.cod}</li>
            </ul>
          </div>
        )}
      </div>
      <div className="zb-footer__bar">
        <div>
          <span>{theme.footer.copyright || tx.rights.replace("{year}", String(new Date().getFullYear())).replace("{name}", storeName)}</span>
          {badges.length > 0 && (
            <span className="zb-badges">
              {badges.map((b) => (
                <span key={b}>{b}</span>
              ))}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Commerce slots (real catalog data, never interactive)
// ---------------------------------------------------------------------------

function priceOf(product: Product): { price?: string; compare?: string | null } {
  const v = product.variants?.[0] as { priceAmount?: string; compareAtAmount?: string | null } | undefined;
  return { price: v?.priceAmount, compare: v?.compareAtAmount ?? null };
}

function ProductCardView({ product, catalog, locale }: { product: Product; catalog: CatalogData; locale: RendererLocale }) {
  const tx = TEXT[locale];
  const { price, compare } = priceOf(product);
  const image = product.media?.[0]?.url;
  return (
    <div className="zb-card">
      <div className="zb-card__media zr-pcard__media">{image ? <img src={image} alt={product.name} loading="lazy" /> : <Svg d={BOX} size={40} />}</div>
      <div className="zb-card__body">
        <p className="zb-card__name">{product.name}</p>
        {price !== undefined && (
          <p className="zb-price">
            <strong>{formatMoney(price, catalog.currency)}</strong>
            {compare && <s className="zr-pcard__compare">{formatMoney(compare, catalog.currency)}</s>}
          </p>
        )}
        <span className="zb-btn zr-pcard__quick">{tx.quick}</span>
      </div>
    </div>
  );
}

function pickProduct(catalog: CatalogData, id: string): Product | undefined {
  return catalog.products.find((p) => p.id === id || p.slug === id) ?? (id ? undefined : catalog.products[0]);
}

function Title({ children }: { children: string }) {
  return children.trim() ? <h2 className="zb-block-title">{children}</h2> : null;
}

function GridPreview({ query, catalog, locale }: { query: ProductGridQuery; catalog: CatalogData; locale: RendererLocale }) {
  const products = catalog.products.slice(0, query.limit);
  return (
    <div>
      <Title>{query.title}</Title>
      {products.length === 0 ? (
        <p className="zb-empty">{TEXT[locale].noProducts}</p>
      ) : (
        <div className="zb-grid" style={{ ["--zb-cols" as string]: String(query.columns), ["--zb-cols-md" as string]: String(Math.min(3, query.columns)) }}>
          {products.map((p) => (
            <ProductCardView key={p.id} product={p} catalog={catalog} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

function SpotPreview({ productRef, catalog, locale, withForm }: { productRef: ProductRef; catalog: CatalogData; locale: RendererLocale; withForm: boolean }) {
  const tx = TEXT[locale];
  const product = pickProduct(catalog, productRef.productId);
  if (!product) return <p className="zb-empty">{tx.noProducts}</p>;
  const { price, compare } = priceOf(product);
  const image = product.media?.[0]?.url;
  return (
    <div>
      <Title>{productRef.title}</Title>
      <div className="zb-spot">
        <div className="zb-card__media zr-pcard__media" style={{ borderRadius: "var(--zr-radius-lg)" }}>
          {image ? <img src={image} alt={product.name} /> : <Svg d={BOX} size={56} />}
        </div>
        <div className="zb-stack">
          <h3>{product.name}</h3>
          {productRef.showPrice && price !== undefined && (
            <p className="zb-price">
              <strong style={{ fontSize: "1.5rem" }}>{formatMoney(price, catalog.currency)}</strong>
              {compare && <s className="zr-pcard__compare">{formatMoney(compare, catalog.currency)}</s>}
            </p>
          )}
          {product.description && <p style={{ color: "var(--zr-text-soft)", fontSize: ".9rem" }}>{product.description.slice(0, 220)}</p>}
          {withForm ? (
            <>
              {[tx.name, tx.phone, tx.address].map((label) => (
                <span key={label} className="zb-field">
                  {label}
                  <span className="zb-input" />
                </span>
              ))}
              <span className="zb-btn">{tx.confirm}</span>
              <p className="zb-note">{tx.formNote}</p>
            </>
          ) : (
            <>
              <span className="zb-btn">{tx.orderNow}</span>
              {productRef.showBuyButton && <span className="zb-btn zb-btn--ghost">{tx.addToCart}</span>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CollectionsPreview({ query, catalog, locale }: { query: CollectionListQuery; catalog: CatalogData; locale: RendererLocale }) {
  const items = catalog.collections.slice(0, query.limit);
  return (
    <div>
      <Title>{query.title}</Title>
      {items.length === 0 ? (
        <p className="zb-empty">{TEXT[locale].noCollections}</p>
      ) : (
        <div className="zb-grid" style={{ ["--zb-cols" as string]: String(query.columns), ["--zb-cols-md" as string]: String(Math.min(3, query.columns)) }}>
          {items.map((c) => (
            <div key={c.id} className="zb-coll">
              {c.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function buildPreviewContext({
  locale,
  catalog,
  editor,
}: {
  locale: RendererLocale;
  catalog: CatalogData;
  editor?: EditorBridge;
}): RenderContext {
  return {
    locale,
    resolveHref: (href) => href,
    // Links never navigate in the builder (the renderer also drops them in editor mode).
    renderLink: (_href, children: ReactNode, className) => <span className={className}>{children}</span>,
    formatMoney: (minor, currency) => formatMoney(minor, currency),
    renderProductGrid: (query) => <GridPreview query={query} catalog={catalog} locale={locale} />,
    renderProductCard: (ref) => <SpotPreview productRef={ref} catalog={catalog} locale={locale} withForm={false} />,
    renderOrderForm: (ref) => <SpotPreview productRef={ref} catalog={catalog} locale={locale} withForm />,
    renderAddToCart: () => <span className="zb-btn">{TEXT[locale].addToCart}</span>,
    renderCollectionList: (query) => <CollectionsPreview query={query} catalog={catalog} locale={locale} />,
    renderCart: ({ title }) => (
      <div className="zb-cart">
        <Title>{title}</Title>
        <p className="zb-note">{TEXT[locale].cartNote}</p>
        <div className="zb-cart__row">
          <span>{TEXT[locale].subtotal}</span>
          <strong>{formatMoney(0, catalog.currency)}</strong>
        </div>
        <span className="zb-btn">{TEXT[locale].orderNow}</span>
      </div>
    ),
    editor,
  };
}

/** Header + page + footer, read-only (thumbnails, website list cards). */
export function StaticStorePreview({
  tree,
  theme,
  locale,
  storeName,
  logoUrl,
  catalog = EMPTY_CATALOG,
}: {
  tree: Tree | null;
  theme: ThemeSettings;
  locale: RendererLocale;
  storeName: string;
  logoUrl?: string | null;
  catalog?: CatalogData;
}) {
  return (
    <>
      <StoreHeaderPreview theme={theme} storeName={storeName} logoUrl={logoUrl} locale={locale} pages={[]} />
      <main className="zb-main">
        <PageRenderer tree={tree} ctx={buildPreviewContext({ locale, catalog })} />
      </main>
      <StoreFooterPreview theme={theme} storeName={storeName} locale={locale} />
    </>
  );
}
