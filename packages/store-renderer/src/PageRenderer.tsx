import { Fragment, type ReactNode } from "react";
import type { RenderContext } from "./context";
import { BeforeAfter } from "./BeforeAfter";
import { Countdown } from "./Countdown";
import { Icon, ICON_PATHS } from "./icons";
import {
  bool,
  futureTime,
  linkList,
  num,
  oneOf,
  qaList,
  safeHref,
  safeUrl,
  str,
  strList,
  videoEmbedUrl,
  type Props,
} from "./props";
import { rendererStrings, type RendererStrings } from "./strings";
import { nodePath, type NodeSettings, type Tree, type TreeColumn, type TreeElement, type TreeRow, type TreeSection } from "./tree";

/**
 * Renders a backend page tree. Pure and hook-free, so it works as a React
 * Server Component (storefront) and in a client SPA (dashboard builder) alike.
 *
 * Layout is structural: a row is a 12-column grid on desktop, columns span
 * `span`. The look comes from optional `settings` on sections/rows/columns
 * (stored as-is by the backend) — see SECTION_SETTINGS below — plus the
 * theme CSS variables on an ancestor `.zr-theme`.
 */

// ---------------------------------------------------------------------------
// Settings vocabulary
// ---------------------------------------------------------------------------

export const SECTION_TONES = ["default", "surface", "soft", "primary", "secondary", "dark", "gradient"] as const;
export const SECTION_WIDTHS = ["narrow", "default", "wide", "full"] as const;
export const SECTION_PADDINGS = ["none", "sm", "md", "lg"] as const;
export const ROW_LAYOUTS = ["grid", "cards", "steps", "logos"] as const;

interface Internal {
  ctx: RenderContext;
  t: RendererStrings;
  editing: boolean;
  now: number;
}

const settingsOf = (node: { settings?: NodeSettings }): Props => (node.settings ?? {}) as Props;
const propsOf = (el: TreeElement): Props => (el.props ?? {}) as Props;

// ---------------------------------------------------------------------------
// Visibility — a block with nothing to show leaves no empty box on the live store
// ---------------------------------------------------------------------------

export function isElementVisible(el: TreeElement, now = Date.now()): boolean {
  const p = propsOf(el);
  switch (el.type) {
    case "heading":
    case "text":
    case "rich_text":
      return str(p, "text").trim() !== "";
    case "image":
      return !!safeUrl(str(p, "src")) || bool(p, "placeholder");
    case "gallery":
      if (str(p, "mode") === "compare") return strList(p, "images").filter((u) => safeUrl(u)).length >= 2 || num(p, "placeholderCount", 0, 0, 12) > 0;
      return strList(p, "images").some((u) => safeUrl(u)) || num(p, "placeholderCount", 0, 0, 12) > 0;
    case "button":
      return str(p, "label").trim() !== "" && !!safeHref(str(p, "href"));
    case "video":
      return !!safeUrl(str(p, "url")) || !!safeUrl(str(p, "poster")) || bool(p, "placeholder");
    case "embed":
      return /^https:\/\//i.test(str(p, "url").trim());
    case "list":
      return strList(p, "items").length > 0;
    case "accordion":
    case "faq":
      return qaList(p, "items").length > 0;
    case "testimonial":
      return str(p, "quote").trim() !== "";
    case "countdown":
      return futureTime(str(p, "endsAt"), now) !== null;
    case "map":
      return str(p, "address").trim() !== "";
    case "social_icons":
      return linkList(p, "links").some((l) => safeHref(l.url));
    case "spacer":
    case "divider":
    case "icon":
    case "form":
    case "product_card":
    case "product_list":
    case "collection_list":
    case "cart":
      return true;
    default:
      return false;
  }
}

const DECORATIVE = new Set(["spacer", "divider", "icon"]);

/**
 * True when a section has at least one visible, non-decorative element.
 * `settings.requires` (an element type) hides the whole section — title
 * included — until at least one element of that type is visible, e.g. a
 * testimonials section with no real quotes yet, or a countdown with no end.
 */
export function sectionHasContent(section: TreeSection, now = Date.now()): boolean {
  const requires = str(settingsOf(section), "requires");
  if (requires) {
    const found = (section.rows ?? []).some((r) =>
      (r.columns ?? []).some((c) => (c.elements ?? []).some((e) => e.type === requires && isElementVisible(e, now)))
    );
    if (!found) return false;
  }
  for (const r of section.rows ?? []) {
    for (const c of r.columns ?? []) {
      for (const e of c.elements ?? []) {
        if (isElementVisible(e, now) && !DECORATIVE.has(e.type)) return true;
      }
    }
  }
  // A pure spacer/divider section is intentional.
  return (section.rows ?? []).some((r) =>
    (r.columns ?? []).some((c) => (c.elements ?? []).length > 0 && (c.elements ?? []).every((e) => e.type === "spacer" || e.type === "divider"))
  );
}

// ---------------------------------------------------------------------------
// Host hooks with defaults
// ---------------------------------------------------------------------------

function link(x: Internal, rawHref: string, children: ReactNode, className?: string): ReactNode {
  const safe = safeHref(rawHref);
  const href = safe ? (x.ctx.resolveHref ? x.ctx.resolveHref(safe) : safe) : null;
  if (!href) return <span className={className}>{children}</span>;
  if (x.editing) {
    // Never navigate away from the builder canvas.
    return <span className={className}>{children}</span>;
  }
  if (/^https?:/i.test(href)) {
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  if (x.ctx.renderLink) return x.ctx.renderLink(href, children, className);
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

function image(x: Internal, src: string, alt: string, sizes?: string, className?: string): ReactNode {
  if (x.ctx.renderImage) return x.ctx.renderImage(src, alt, sizes, className);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} sizes={sizes} loading="lazy" decoding="async" className={className} />;
}

/** Inline-editable text in editor mode; plain text otherwise. */
function Editable({
  x,
  path,
  field,
  value,
  as: Tag = "span",
  className,
  id,
}: {
  x: Internal;
  path: string;
  field: string;
  value: string;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "blockquote" | "figcaption";
  className?: string;
  id?: string;
}) {
  const onEdit = x.ctx.editor?.onInlineEdit;
  if (!x.editing || !onEdit) {
    return (
      <Tag className={className} id={id}>
        {value}
      </Tag>
    );
  }
  return (
    <Tag
      className={`${className ?? ""} zr-inline`}
      id={id}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-zr-field={field}
      onBlur={(e: { currentTarget: HTMLElement }) => {
        const next = e.currentTarget.innerText.replace(/\n{3,}/g, "\n\n");
        if (next !== value) onEdit(path, field, next);
      }}
    >
      {value}
    </Tag>
  );
}

function EditorHint({ children }: { children: ReactNode }) {
  return <div className="zr-editor-hint">{children}</div>;
}

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

const RATIOS: Record<string, string> = { "1/1": "1 / 1", "4/5": "4 / 5", "3/4": "3 / 4", "3/2": "3 / 2", "4/3": "4 / 3", "16/9": "16 / 9", "21/9": "21 / 9" };

function ratioStyle(p: Props, fallback?: string) {
  const r = RATIOS[str(p, "ratio", fallback ?? "")];
  return r ? { aspectRatio: r } : undefined;
}

function Placeholder({ x, label, icon = "image", ratio }: { x: Internal; label: string; icon?: string; ratio?: { aspectRatio: string } }) {
  return (
    <div className="zr-ph" role="img" aria-label={label} style={ratio}>
      <span className="zr-ph__icon">
        <Icon name={icon} size={36} />
      </span>
      {x.editing && <span className="zr-ph__cap">{label}</span>}
    </div>
  );
}

const YES = /^(✓|✔|✅|نعم|أيوه|yes)$/i;
const NO = /^(✗|✘|×|❌|x|لا|no)$/i;

function renderTable(text: string, x: Internal, path: string, variant = ""): ReactNode {
  const compare = variant === "compare";
  const rows = text
    .split("\n")
    .map((line) => line.split("|").map((c) => c.trim()))
    .filter((cells) => cells.some((c) => c !== ""));
  if (rows.length === 0) return null;
  const [rawHead, ...rawBody] = rows;
  // Comparison tables show ✓ / ✗ as coloured icons (text kept for screen readers).
  const mark = (c: string): ReactNode => {
    if (!compare) return c;
    if (YES.test(c))
      return (
        <span className="zr-mark zr-mark--yes">
          <Icon name="check" size={16} strokeWidth={2.8} />
          <span className="zr-sr">{c}</span>
        </span>
      );
    if (NO.test(c))
      return (
        <span className="zr-mark zr-mark--no">
          <Icon name="close" size={14} strokeWidth={2.8} />
          <span className="zr-sr">{c}</span>
        </span>
      );
    return c;
  };
  const head = rawHead;
  const body = rawBody.map((cells) => cells.map((c) => c));
  return (
    <div className="zr-table-wrap" tabIndex={0} data-zr-field={x.editing ? "text" : undefined} data-zr-path={x.editing ? path : undefined}>
      <table className={compare ? "zr-table zr-table--compare" : "zr-table"}>
        <thead>
          <tr>
            {head.map((c, i) => (
              <th key={i} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        {body.length > 0 && (
          <tbody>
            {body.map((cells, ri) => (
              <tr key={ri}>
                {head.map((_, ci) => (ci === 0 ? <th key={ci} scope="row">{cells[ci] ?? ""}</th> : <td key={ci}>{mark(cells[ci] ?? "")}</td>))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}

function ElementView({ el, x, path }: { el: TreeElement; x: Internal; path: string }): ReactNode {
  const p = propsOf(el);
  const { t } = x;

  switch (el.type) {
    case "heading": {
      const text = str(p, "text");
      if (!text.trim() && !x.editing) return null;
      const level = num(p, "level", 2, 1, 6);
      const eyebrow = str(p, "eyebrow");
      const size = oneOf(p, "size", ["default", "display", "sm"] as const, "default");
      return (
        <div className={`zr-heading zr-heading--${size}`}>
          {eyebrow.trim() && <Editable x={x} path={path} field="eyebrow" value={eyebrow} as="p" className="zr-eyebrow" />}
          <Editable x={x} path={path} field="text" value={text} as={`h${level}` as "h2"} className={`zr-h zr-h--${level}`} />
        </div>
      );
    }

    case "text": {
      const text = str(p, "text");
      if (!text.trim() && !x.editing) return null;
      const size = oneOf(p, "size", ["base", "lead", "sm"] as const, "base");
      return <Editable x={x} path={path} field="text" value={text} as="p" className={`zr-text zr-text--${size}`} />;
    }

    case "rich_text": {
      const text = str(p, "text");
      if (!text.trim() && !x.editing) return null;
      if (str(p, "format") === "table") return renderTable(text, x, path, str(p, "variant"));
      return <Editable x={x} path={path} field="text" value={text} as="p" className="zr-text zr-rich" />;
    }

    case "image": {
      const src = safeUrl(str(p, "src"));
      const alt = str(p, "alt");
      const ratio = ratioStyle(p);
      const rounded = str(p, "shape") === "circle" ? " zr-img--circle" : "";
      if (!src) {
        if (!bool(p, "placeholder") && !x.editing) return null;
        return <Placeholder x={x} label={alt || t.imagePlaceholder} ratio={ratio ?? { aspectRatio: "4 / 3" }} />;
      }
      const img = (
        <div className={`zr-img${rounded}`} style={ratio}>
          {image(x, src, alt, str(p, "sizes") || "(min-width: 768px) 50vw, 100vw", "zr-img__el")}
        </div>
      );
      const href = str(p, "href");
      return href.trim() ? link(x, href, img, "zr-img-link") : img;
    }

    case "gallery": {
      const images = strList(p, "images").map(safeUrl).filter((u): u is string => !!u);
      const columns = num(p, "columns", 3, 1, 6);
      const title = str(p, "title");
      if (str(p, "mode") === "compare") {
        const beforeLabel = str(p, "beforeLabel");
        const afterLabel = str(p, "afterLabel");
        const heading = title.trim() ? <Editable x={x} path={path} field="title" value={title} as="h3" className="zr-h zr-h--3" /> : null;
        if (images.length >= 2) {
          return (
            <div className="zr-gallery-block">
              {heading}
              <BeforeAfter before={images[0]} after={images[1]} beforeLabel={beforeLabel} afterLabel={afterLabel} />
            </div>
          );
        }
        if (!x.editing && num(p, "placeholderCount", 0, 0, 12) === 0) return null;
        return (
          <div className="zr-gallery-block">
            {heading}
            <div className="zr-ba zr-ba--ph">
              {[beforeLabel || t.imagePlaceholder, afterLabel || t.imagePlaceholder].map((label, i) => (
                <div key={i} className="zr-ba__half">
                  <Placeholder x={x} label={label} ratio={{ aspectRatio: "4 / 5" }} />
                  {label && <span className={`zr-ba__tag zr-ba__tag--${i === 0 ? "before" : "after"}`}>{label}</span>}
                </div>
              ))}
            </div>
          </div>
        );
      }
      const placeholders = images.length === 0 ? num(p, "placeholderCount", x.editing ? 3 : 0, 0, 12) : 0;
      if (images.length === 0 && placeholders === 0) return null;
      return (
        <div className="zr-gallery-block">
          {title.trim() && <Editable x={x} path={path} field="title" value={title} as="h3" className="zr-h zr-h--3" />}
          <ul className="zr-gallery" style={{ ["--zr-cols" as string]: String(columns) }}>
            {images.map((src, i) => (
              <li key={`${src}-${i}`} className="zr-gallery__item">
                {image(x, src, "", "(min-width: 768px) 33vw, 50vw", "zr-img__el")}
              </li>
            ))}
            {Array.from({ length: placeholders }, (_, i) => (
              <li key={`ph-${i}`} className="zr-gallery__item">
                <Placeholder x={x} label={t.imagePlaceholder} ratio={{ aspectRatio: "1 / 1" }} />
              </li>
            ))}
          </ul>
        </div>
      );
    }

    case "button": {
      const label = str(p, "label");
      const href = str(p, "href");
      const variant = oneOf(p, "variant", ["primary", "secondary", "outline", "link", "light"] as const, "primary");
      const size = oneOf(p, "size", ["md", "lg"] as const, "md");
      const icon = str(p, "icon").trim().toLowerCase();
      if (!label.trim() && !x.editing) return null;
      const cls = `zr-btn zr-btn--${variant} zr-btn--${size}`;
      const content = (
        <>
          {icon && ICON_PATHS[icon] && icon !== "arrow" && <Icon name={icon} size={20} />}
          <Editable x={x} path={path} field="label" value={label} />
          {icon === "arrow" && <Icon name="arrow" size={18} className="zr-flip-rtl" />}
        </>
      );
      if (!safeHref(href)) {
        if (!x.editing) return null;
        return (
          <span className={`${cls} zr-btn--nolink`} title={t.editorEmptyButtonLink}>
            {content}
          </span>
        );
      }
      return link(x, href, content, cls);
    }

    case "video": {
      const url = safeUrl(str(p, "url"));
      const poster = safeUrl(str(p, "poster"));
      const title = str(p, "title");
      if (!url) {
        if (poster) {
          return <div className="zr-video zr-video--poster">{image(x, poster, title, "100vw", "zr-img__el")}</div>;
        }
        if (!bool(p, "placeholder") && !x.editing) return null;
        return (
          <div className="zr-video zr-video--ph" role="img" aria-label={title || t.videoPlaceholder}>
            <span className="zr-video__play" aria-hidden>
              <Icon name="play" size={30} strokeWidth={0} />
            </span>
            {x.editing && <span className="zr-ph__cap">{t.videoPlaceholder}</span>}
          </div>
        );
      }
      const embed = videoEmbedUrl(url);
      return (
        <div className="zr-video">
          {embed ? (
            <iframe
              src={embed}
              title={title || t.video}
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="zr-video__frame"
              style={x.editing ? { pointerEvents: "none" } : undefined}
            />
          ) : (
            <video src={url} poster={poster ?? undefined} controls preload="metadata" className="zr-video__frame">
              {t.noVideo}
            </video>
          )}
        </div>
      );
    }

    case "embed": {
      const url = str(p, "url").trim();
      if (!/^https:\/\//i.test(url)) return x.editing ? <EditorHint>{t.editorEmptyBlock("embed")}</EditorHint> : null;
      const title = str(p, "title");
      return (
        <div className="zr-embed">
          <iframe src={url} title={title || t.embedded} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups" className="zr-video__frame" />
        </div>
      );
    }

    case "spacer":
      return <div className="zr-spacer" style={{ height: num(p, "height", 48, 4, 400) }} aria-hidden />;

    case "divider":
      return <hr className={`zr-divider zr-divider--${oneOf(p, "style", ["solid", "dashed", "short"] as const, "solid")}`} />;

    case "icon": {
      const name = str(p, "name");
      const size = num(p, "size", 28, 12, 120);
      const style = oneOf(p, "style", ["badge", "plain"] as const, "badge");
      return (
        <span className={`zr-icon zr-icon--${style}`} style={{ ["--zr-icon" as string]: `${size}px` }}>
          <Icon name={name} size={size} label={str(p, "label") || undefined} />
        </span>
      );
    }

    case "list": {
      const items = strList(p, "items");
      const title = str(p, "title");
      if (items.length === 0) return x.editing ? <EditorHint>{t.editorEmptyBlock("list")}</EditorHint> : null;
      const style = oneOf(p, "style", ["check", "dot", "number", "marquee"] as const, "check");
      if (style === "marquee") {
        // Two identical tracks loop seamlessly; the copy is hidden from screen readers.
        const icon = str(p, "icon").trim().toLowerCase();
        const track = (hidden: boolean) => (
          <ul className="zr-marquee__track" aria-hidden={hidden || undefined}>
            {items.map((item, i) => (
              <li key={i}>
                <span className="zr-marquee__dot" aria-hidden>
                  {icon && ICON_PATHS[icon] ? <Icon name={icon} size={16} strokeWidth={2.4} /> : "✦"}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        );
        return (
          <div className="zr-marquee" style={{ ["--zr-marquee-dur" as string]: `${num(p, "speed", 30, 8, 120)}s` }}>
            {track(false)}
            {track(true)}
          </div>
        );
      }
      const Tag = style === "number" ? "ol" : "ul";
      return (
        <div className="zr-list-block">
          {title.trim() && <Editable x={x} path={path} field="title" value={title} as="h3" className="zr-h zr-h--4" />}
          <Tag className={`zr-list zr-list--${style}`}>
            {items.map((item, i) => (
              <li key={i}>
                {style === "check" && (
                  <span className="zr-list__mark" aria-hidden>
                    <Icon name="check" size={14} strokeWidth={2.4} />
                  </span>
                )}
                <span>{item}</span>
              </li>
            ))}
          </Tag>
        </div>
      );
    }

    case "accordion":
    case "faq": {
      const items = qaList(p, "items");
      const title = str(p, "title");
      if (items.length === 0) return x.editing ? <EditorHint>{t.editorEmptyBlock(el.type)}</EditorHint> : null;
      return (
        <div className="zr-faq-block">
          {title.trim() && <Editable x={x} path={path} field="title" value={title} as="h3" className="zr-h zr-h--3" />}
          <div className="zr-faq">
            {items.map((item, i) => (
              <details key={i} className="zr-faq__item" open={x.editing && i === 0 ? true : undefined}>
                <summary className="zr-faq__q">
                  <span>{item.q || t.item(i + 1)}</span>
                  <span className="zr-faq__sign" aria-hidden />
                </summary>
                {item.a.trim() && <p className="zr-faq__a">{item.a}</p>}
              </details>
            ))}
          </div>
        </div>
      );
    }

    case "testimonial": {
      const quote = str(p, "quote");
      const author = str(p, "author");
      const role = str(p, "role");
      if (!quote.trim()) {
        return x.editing ? (
          <figure className="zr-quote zr-quote--empty">
            <EditorHint>{t.editorEmptyTestimonial}</EditorHint>
          </figure>
        ) : null;
      }
      const rating = num(p, "rating", 0, 0, 5);
      return (
        <figure className="zr-quote">
          <span className="zr-quote__mark" aria-hidden>
            <Icon name="quote" size={28} />
          </span>
          {rating > 0 && (
            <p className="zr-quote__stars" aria-label={t.rating(rating)}>
              <span aria-hidden>{"★".repeat(rating) + "☆".repeat(5 - rating)}</span>
            </p>
          )}
          <Editable x={x} path={path} field="quote" value={quote} as="blockquote" className="zr-quote__text" />
          {author.trim() && (
            <figcaption className="zr-quote__author">
              <span className="zr-quote__name">{author}</span>
              {role.trim() && <span className="zr-quote__role">{role}</span>}
            </figcaption>
          )}
        </figure>
      );
    }

    case "countdown": {
      const endsAt = futureTime(str(p, "endsAt"), x.now);
      if (endsAt === null) return x.editing ? <EditorHint>{t.editorEmptyCountdown}</EditorHint> : null;
      return (
        <Countdown
          endsAt={endsAt}
          label={str(p, "label")}
          units={[t.countdownDays, t.countdownHours, t.countdownMinutes, t.countdownSeconds]}
        />
      );
    }

    case "form": {
      // No backend endpoint accepts generic form submissions: presentational only, and it says so.
      const title = str(p, "title");
      const id = `zr-form-${el.id}`;
      return (
        <div className="zr-form">
          {title.trim() && <Editable x={x} path={path} field="title" value={title} as="h3" className="zr-h zr-h--4" />}
          <label className="zr-field" htmlFor={`${id}-n`}>
            <span>{t.formName}</span>
            <input id={`${id}-n`} className="zr-input" type="text" disabled />
          </label>
          <label className="zr-field" htmlFor={`${id}-p`}>
            <span>{t.formPhone}</span>
            <input id={`${id}-p`} className="zr-input" type="tel" dir="ltr" disabled />
          </label>
          <label className="zr-field" htmlFor={`${id}-m`}>
            <span>{t.formMessage}</span>
            <textarea id={`${id}-m`} className="zr-input" rows={3} disabled />
          </label>
          <button type="button" className="zr-btn zr-btn--primary zr-btn--md" disabled>
            {str(p, "submitLabel", t.formSend) || t.formSend}
          </button>
          <p className="zr-form__note">{t.formPreview}</p>
        </div>
      );
    }

    case "map": {
      const address = str(p, "address");
      if (!address.trim()) return x.editing ? <EditorHint>{t.editorEmptyBlock("map")}</EditorHint> : null;
      const title = str(p, "title");
      return (
        <div className="zr-map">
          <span className="zr-map__pin" aria-hidden>
            <Icon name="location" size={28} />
          </span>
          <div className="zr-map__body">
            {title.trim() && <p className="zr-map__title">{title}</p>}
            <Editable x={x} path={path} field="address" value={address} as="p" className="zr-map__addr" />
            {link(
              x,
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
              <>
                {t.openInMaps}
                <Icon name="arrow" size={16} className="zr-flip-rtl" />
              </>,
              "zr-btn zr-btn--link zr-btn--md"
            )}
          </div>
        </div>
      );
    }

    case "social_icons": {
      const links = linkList(p, "links").filter((l) => safeHref(l.url));
      if (links.length === 0) return x.editing ? <EditorHint>{t.editorEmptyBlock("social_icons")}</EditorHint> : null;
      return (
        <ul className="zr-social">
          {links.map((l, i) => {
            const key = l.platform.trim().toLowerCase();
            const icon = key.includes("whats") ? "whatsapp" : key.includes("phone") || key.includes("tel") ? "phone" : key.includes("mail") ? "mail" : "";
            return (
              <li key={`${l.url}-${i}`}>
                {link(
                  x,
                  l.url,
                  <>
                    {icon && <Icon name={icon} size={18} />}
                    <span>{l.platform.trim() || t.link}</span>
                  </>,
                  "zr-social__link"
                )}
              </li>
            );
          })}
        </ul>
      );
    }

    case "product_card": {
      const ref = {
        productId: str(p, "productId").trim(),
        title: str(p, "title"),
        showPrice: bool(p, "showPrice", true),
        showBuyButton: bool(p, "showBuyButton", true),
        variant: oneOf(p, "variant", ["card", "landing"] as const, "card"),
      };
      const slot = ref.variant === "landing" ? (x.ctx.renderOrderForm ?? x.ctx.renderProductCard) : x.ctx.renderProductCard;
      return slot ? <div className="zr-commerce">{slot(ref)}</div> : <CommercePlaceholder x={x} kind="product_card" />;
    }

    case "product_list": {
      const query = {
        title: str(p, "title"),
        source: str(p, "source", "newest"),
        collectionId: str(p, "collectionId").trim(),
        limit: num(p, "limit", 8, 1, 48),
        columns: num(p, "columns", 4, 1, 6),
      };
      return x.ctx.renderProductGrid ? <div className="zr-commerce">{x.ctx.renderProductGrid(query)}</div> : <CommercePlaceholder x={x} kind="product_list" count={Math.min(query.limit, query.columns)} />;
    }

    case "collection_list": {
      const query = { title: str(p, "title"), limit: num(p, "limit", 6, 1, 24), columns: num(p, "columns", 3, 1, 6) };
      return x.ctx.renderCollectionList ? <div className="zr-commerce">{x.ctx.renderCollectionList(query)}</div> : <CommercePlaceholder x={x} kind="collection_list" count={Math.min(query.limit, query.columns)} />;
    }

    case "cart":
      return x.ctx.renderCart ? <div className="zr-commerce">{x.ctx.renderCart({ title: str(p, "title") })}</div> : <CommercePlaceholder x={x} kind="cart" />;

    default:
      return null;
  }
}

function CommercePlaceholder({ x, kind, count = 1 }: { x: Internal; kind: string; count?: number }) {
  if (!x.editing) return null;
  return (
    <div className="zr-commerce-ph" aria-label={x.t.commerceUnavailable}>
      <div className="zr-commerce-ph__grid" style={{ ["--zr-cols" as string]: String(Math.max(1, count)) }}>
        {Array.from({ length: Math.max(1, count) }, (_, i) => (
          <div key={i} className="zr-commerce-ph__card">
            <div className="zr-ph" style={{ aspectRatio: "var(--zr-card-ratio, 1 / 1)" }}>
              <span className="zr-ph__icon">
                <Icon name="box" size={32} />
              </span>
            </div>
            <span className="zr-skel" />
            <span className="zr-skel zr-skel--short" />
          </div>
        ))}
      </div>
      <p className="zr-ph__cap">
        {x.t.commerceUnavailable} · {kind}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Containers
// ---------------------------------------------------------------------------

/**
 * Editor attributes for a node we own the markup of (section, column). In live
 * mode this is an empty object, so published HTML carries no editor noise.
 */
function editorAttrs(x: Internal, path: string, kind: string): { className: string; attrs: Record<string, unknown> } {
  if (!x.editing) return { className: "", attrs: {} };
  const selected = x.ctx.editor?.selectedPath === path;
  return {
    className: ` zr-edit-node${selected ? " zr-edit--selected" : ""}`,
    attrs: {
      "data-zr-path": path,
      "data-zr-kind": kind,
      onClick: (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        x.ctx.editor?.onSelect?.(path);
      },
    },
  };
}

/**
 * Elements render arbitrary roots, so in editor mode they get a
 * `display: contents` wrapper: it catches clicks and carries the path without
 * changing layout — the canvas matches the published page.
 */
function Selectable({ x, path, kind, children }: { x: Internal; path: string; kind: string; children: ReactNode }) {
  if (!x.editing) return <>{children}</>;
  const selected = x.ctx.editor?.selectedPath === path;
  return (
    <div
      className={`zr-edit${selected ? " zr-edit--selected" : ""}`}
      data-zr-path={path}
      data-zr-kind={kind}
      onClick={(e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        x.ctx.editor?.onSelect?.(path);
      }}
    >
      {children}
    </div>
  );
}

function ColumnView({ column, x, basePath }: { column: TreeColumn; x: Internal; basePath: string }) {
  const s = settingsOf(column);
  const span = Number.isInteger(column.span) ? Math.min(12, Math.max(1, column.span as number)) : 12;
  const path = nodePath(basePath, column.id);
  const elements = (Array.isArray(column.elements) ? column.elements : []).filter((e) => x.editing || isElementVisible(e, x.now));
  if (elements.length === 0 && !x.editing) return null;

  // Consecutive buttons share one wrapping row.
  const groups: Array<TreeElement[]> = [];
  for (const e of elements) {
    const last = groups[groups.length - 1];
    if (e.type === "button" && last && last[0].type === "button") last.push(e);
    else groups.push([e]);
  }

  const cls = [
    "zr-col",
    bool(s, "card") ? "zr-col--card" : "",
    bool(s, "highlight") ? "zr-col--highlight" : "",
    str(s, "align") === "center" ? "zr-col--center" : "",
    str(s, "valign") === "center" ? "zr-col--vcenter" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const ed = editorAttrs(x, path, "column");
  return (
    <div className={cls + ed.className} style={{ ["--zr-span" as string]: String(span) }} {...ed.attrs}>
        {groups.map((group) => {
          const nodes = group.map((e) => {
            const ep = nodePath(path, e.id);
            return (
              <Selectable key={e.id} x={x} path={ep} kind={e.type}>
                <ElementView el={e} x={x} path={ep} />
              </Selectable>
            );
          });
          return group[0].type === "button" && group.length > 1 ? (
            <div key={group[0].id} className="zr-btns">
              {nodes}
            </div>
          ) : (
            <Fragment key={group[0].id}>{nodes}</Fragment>
          );
        })}
        {x.editing && elements.length === 0 && <EditorHint>+</EditorHint>}
    </div>
  );
}

function RowView({ row, x, basePath }: { row: TreeRow; x: Internal; basePath: string }) {
  const s = settingsOf(row);
  const columns = Array.isArray(row.columns) ? row.columns : [];
  if (columns.length === 0) return null;
  const layout = oneOf(s, "layout", ROW_LAYOUTS, "grid");
  const mobile = num(s, "mobileColumns", 1, 1, 2);
  const cls = [
    "zr-row",
    `zr-row--${layout}`,
    `zr-row--m${mobile}`,
    str(s, "valign") === "center" ? "zr-row--vcenter" : "",
    bool(s, "reverse") ? "zr-row--reverse" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const path = nodePath(basePath, row.id);
  return (
    <div className={cls}>
      {columns.map((c) => (
        <ColumnView key={c.id} column={c} x={x} basePath={path} />
      ))}
    </div>
  );
}

function cssUrl(url: string) {
  return `url("${url.replace(/["\\\n\r]/g, "")}")`;
}

export function SectionRenderer({ section, ctx, now }: { section: TreeSection; ctx: RenderContext; now?: number }) {
  const x: Internal = { ctx, t: rendererStrings(ctx.locale, ctx.t), editing: !!ctx.editor?.enabled, now: now ?? Date.now() };
  return <SectionView section={section} x={x} />;
}

function SectionView({ section, x }: { section: TreeSection; x: Internal }) {
  const rows = Array.isArray(section.rows) ? section.rows : [];
  const s = settingsOf(section);
  // `hidden` keeps a section in the draft without showing it on the live store.
  if (!x.editing && bool(s, "hidden")) return null;
  if (!x.editing && (rows.length === 0 || !sectionHasContent(section, x.now))) return null;
  const variant = str(s, "variant", "default").replace(/[^a-z0-9-]/gi, "") || "default";
  const tone = oneOf(s, "tone", SECTION_TONES, "default");
  const width = oneOf(s, "width", SECTION_WIDTHS, "default");
  const padding = oneOf(s, "padding", SECTION_PADDINGS, "md");
  const bg = safeUrl(str(s, "backgroundImage"));
  const anchor = str(s, "anchor").replace(/[^a-z0-9-_]/gi, "");
  const cls = [
    "zr-sec",
    `zr-sec--${variant}`,
    `zr-tone-${tone}`,
    `zr-pad-${padding}`,
    str(s, "align") === "center" ? "zr-sec--center" : "",
    bg ? "zr-sec--has-bg" : "",
    bool(s, "decor") ? "zr-sec--decor" : "",
    bool(s, "hideOnMobile") ? "zr-hide-mobile" : "",
    bool(s, "hideOnDesktop") ? "zr-hide-desktop" : "",
    x.editing && bool(s, "hidden") ? "zr-sec--hidden" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const ed = editorAttrs(x, section.id, "section");
  return (
    <section
      className={cls + ed.className}
      id={anchor || undefined}
      style={bg ? { ["--zr-sec-bg" as string]: cssUrl(bg) } : undefined}
      {...ed.attrs}
    >
      {bool(s, "decor") && (
        <span className="zr-decor" aria-hidden>
          <span className="zr-decor__a" />
          <span className="zr-decor__b" />
        </span>
      )}
      <div className={`zr-sec__inner zr-w-${width}`}>
        {rows.map((r) => (
          <RowView key={r.id} row={r} x={x} basePath={section.id} />
        ))}
      </div>
    </section>
  );
}

export function PageRenderer({
  tree,
  ctx,
  className,
  now,
}: {
  tree: Tree | { sections?: unknown } | null | undefined;
  ctx: RenderContext;
  className?: string;
  /** Fixed clock for deterministic rendering (tests, builder previews). */
  now?: number;
}) {
  const sections = (Array.isArray(tree?.sections) ? tree.sections : []) as TreeSection[];
  if (sections.length === 0 && !ctx.editor?.enabled) return null;
  const x: Internal = { ctx, t: rendererStrings(ctx.locale, ctx.t), editing: !!ctx.editor?.enabled, now: now ?? Date.now() };
  return (
    <div className={`zr-page${x.editing ? " zr-page--editing" : ""}${className ? ` ${className}` : ""}`}>
      {sections.map((s) => (s && typeof s === "object" && typeof s.id === "string" ? <SectionView key={s.id} section={s} x={x} /> : null))}
    </div>
  );
}
