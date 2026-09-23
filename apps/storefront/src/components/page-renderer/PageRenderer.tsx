import type {
  PageColumn,
  PageElement,
  PageRow,
  PageSection,
  PageTree,
} from "@store-builder/api-client";
import { getDictionary, type Dictionary, type Locale } from "@/lib/i18n";
import {
  CartElement,
  CollectionListElement,
  ProductCardElement,
  ProductListElement,
} from "./commerce";
import {
  AccordionElement,
  ButtonElement,
  CountdownElement,
  DividerElement,
  EmbedElement,
  FaqElement,
  FormElement,
  GalleryElement,
  HeadingElement,
  IconElement,
  ImageElement,
  ListElement,
  MapElement,
  SocialIconsElement,
  SpacerElement,
  TestimonialElement,
  TextElement,
  VideoElement,
} from "./elements";
import {
  OrbitGalleryElement,
  Product3DElement,
  ScrollStoryElement,
  ShaderHeroElement,
} from "./immersive";
import { ComparisonElement, MarqueeElement } from "./sections";
import { columnClasses, rowClasses, sectionClasses } from "./layout";
import { SPAN_CLASS, propsOf } from "./props";

/**
 * Renders a published page built in the merchant's website editor.
 *
 * The tree is the strict four-level shape the backend enforces on every write
 * (modules/pages/pageTree.js):
 *
 *   PageTree -> sections[] -> rows[] -> columns[] -> elements[]
 *
 * Only `elements` are typed; sections, rows and columns are pure containers, so
 * layout here is entirely structural — a row is a 12-column grid, a column
 * spans `span` of it, and elements stack inside. Grid order follows the
 * document direction, so an RTL store lays columns out right-to-left.
 *
 * Every node is treated as untrusted: the tree can come from a template, from
 * the editor, or from a hand-written API call, and only its *structure* was
 * validated server-side — never the props inside an element.
 */

/**
 * Funnel mode. A funnel keeps the shopper on one path, so the commerce
 * blocks' outbound links — "order now" and "view details" on a product card,
 * every card in a product grid — go to the funnel's next step instead of the
 * product page. `nextHref` is resolved like any merchant link (props.ts
 * resolveHref), so a store-relative path and a full `/store/<id>/…` path both
 * work. Unset, nothing changes.
 */
export interface PageRendererFunnel {
  nextHref: string;
}

interface Ctx {
  workspaceId: string;
  currency: string;
  locale: Locale;
  t: Dictionary;
  funnel?: PageRendererFunnel;
}

function ElementNode({ element, ctx }: { element: PageElement; ctx: Ctx }) {
  const props = propsOf(element);
  const { t } = ctx;

  switch (element.type) {
    case "heading":
      return <HeadingElement props={props} />;
    case "text":
      return <TextElement props={props} />;
    case "rich_text":
      return <TextElement props={props} large />;
    case "image":
      return <ImageElement props={props} />;
    case "gallery":
      return <GalleryElement props={props} />;
    case "button":
      return <ButtonElement props={props} />;
    case "video":
      return <VideoElement props={props} t={t} />;
    case "embed":
      return <EmbedElement props={props} t={t} />;
    case "spacer":
      return <SpacerElement props={props} />;
    case "divider":
      return <DividerElement props={props} />;
    case "icon":
      return <IconElement props={props} />;
    case "list":
      return <ListElement props={props} />;
    case "accordion":
      return <AccordionElement props={props} t={t} />;
    case "faq":
      return <FaqElement props={props} t={t} />;
    case "testimonial":
      return <TestimonialElement props={props} t={t} />;
    case "countdown":
      return <CountdownElement props={props} />;
    case "form":
      return <FormElement props={props} t={t} />;
    case "map":
      return <MapElement props={props} t={t} />;
    case "social_icons":
      return <SocialIconsElement props={props} t={t} />;
    case "product_card":
      return (
        <ProductCardElement
          props={props}
          workspaceId={ctx.workspaceId}
          currency={ctx.currency}
          locale={ctx.locale}
          funnel={ctx.funnel}
        />
      );
    case "product_list":
      return (
        <ProductListElement
          props={props}
          workspaceId={ctx.workspaceId}
          currency={ctx.currency}
          locale={ctx.locale}
          funnel={ctx.funnel}
        />
      );
    case "collection_list":
      return <CollectionListElement props={props} workspaceId={ctx.workspaceId} />;
    case "cart":
      return <CartElement props={props} />;
    case "shader_hero":
      return <ShaderHeroElement props={props} locale={ctx.locale} />;
    case "product_3d":
      return <Product3DElement props={props} workspaceId={ctx.workspaceId} locale={ctx.locale} />;
    case "orbit_gallery":
      return (
        <OrbitGalleryElement props={props} workspaceId={ctx.workspaceId} currency={ctx.currency} locale={ctx.locale} />
      );
    case "scroll_story":
      return <ScrollStoryElement props={props} />;
    case "marquee":
      return <MarqueeElement props={props} />;
    case "comparison":
      return <ComparisonElement props={props} t={t} />;
    default:
      // Unreachable for the 23 allowed types, but a tree written before this
      // renderer knew about a new type must not blank the page.
      return null;
  }
}

/**
 * Rows and columns carry the same kind of free-form `settings` as a section
 * (a column's card surface and alignment, a row's gap — see layout.ts), but
 * the api-client's types only declare it on sections and elements. Read it
 * off the node as the unknown it is; layout.ts checks the shape.
 */
function settingsOf(node: PageRow | PageColumn): unknown {
  return (node as { settings?: unknown }).settings;
}

function ColumnNode({ column, ctx }: { column: PageColumn; ctx: Ctx }) {
  const span = Number.isInteger(column.span) ? Math.min(12, Math.max(1, column.span!)) : 12;
  const elements = Array.isArray(column.elements) ? column.elements : [];

  return (
    <div className={columnClasses(settingsOf(column), SPAN_CLASS[span])}>
      {elements.map((element) => (
        <ElementNode key={element.id} element={element} ctx={ctx} />
      ))}
    </div>
  );
}

function RowNode({ row, ctx }: { row: PageRow; ctx: Ctx }) {
  const columns = Array.isArray(row.columns) ? row.columns : [];
  if (columns.length === 0) return null;

  return (
    <div className={rowClasses(settingsOf(row))}>
      {columns.map((column) => (
        <ColumnNode key={column.id} column={column} ctx={ctx} />
      ))}
    </div>
  );
}

/**
 * A section's optional `settings` — the small amount of look a section carries
 * itself, written by the editor's block presets and its section panel. The
 * class tables and their fallbacks live in layout.ts; a section without
 * settings gets exactly the classes it always had.
 */
function SectionNode({ section, ctx }: { section: PageSection; ctx: Ctx }) {
  const rows = Array.isArray(section.rows) ? section.rows : [];
  if (rows.length === 0) return null;

  const { outer, inner } = sectionClasses(section.settings);

  return (
    <section className={outer}>
      <div className={inner}>
        {rows.map((row) => (
          <RowNode key={row.id} row={row} ctx={ctx} />
        ))}
      </div>
    </section>
  );
}

/**
 * A section as the website editor's canvas sees it: wrapped in a plain element
 * that names it, so the preview bridge (components/preview/PreviewBridge) can
 * outline it and report clicks to the editor. The wrapper has no styling of
 * its own, so the section inside looks exactly as it does to shoppers. A
 * section with no rows — which renders nothing at all on the store — gets a
 * visible empty slot here, or the merchant could never click it.
 */
function EditableSectionNode({
  section,
  index,
  ctx,
}: {
  section: PageSection;
  index: number;
  ctx: Ctx;
}) {
  const hasRows = Array.isArray(section.rows) && section.rows.length > 0;
  return (
    <div data-zimos-section={section.id} data-zimos-index={index}>
      {hasRows ? (
        <SectionNode section={section} ctx={ctx} />
      ) : (
        <div className="px-4 py-6 sm:px-6">
          <div className="mx-auto h-24 max-w-6xl rounded-[var(--radius-card)] border-2 border-dashed border-line" />
        </div>
      )}
    </div>
  );
}

export function PageRenderer({
  tree,
  workspaceId,
  currency,
  locale,
  editable = false,
  funnel,
}: {
  tree: PageTree | null;
  workspaceId: string;
  currency: string;
  locale: Locale;
  /**
   * The website editor's preview only (app/store/[workspaceId]/preview): mark
   * every section so it can be selected from the canvas. Never set on a page
   * shoppers see, which renders exactly as it did before this existed.
   */
  editable?: boolean;
  /** A running funnel's step page: commerce links go to the next step. See PageRendererFunnel. */
  funnel?: PageRendererFunnel;
}) {
  const sections = Array.isArray(tree?.sections) ? tree.sections : [];
  if (sections.length === 0) return null;
  const ctx: Ctx = { workspaceId, currency, locale, t: getDictionary(locale), funnel };

  return (
    <div className="divide-y divide-line">
      {sections.map((section, index) =>
        editable ? (
          <EditableSectionNode key={section.id} section={section} index={index} ctx={ctx} />
        ) : (
          <SectionNode key={section.id} section={section} ctx={ctx} />
        )
      )}
    </div>
  );
}
