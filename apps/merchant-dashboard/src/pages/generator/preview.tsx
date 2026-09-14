import { createElement, type CSSProperties, type KeyboardEvent } from "react";
import { BadgeCheck, ChevronDown, ImageIcon, Shuffle, ShieldCheck, Star, Truck } from "lucide-react";
import { cn } from "@store-builder/ui";
import type { PageColumn, PageElement, PageSection, PageTree } from "@store-builder/api-client";
import { sectionKeyOf } from "./treeBuilder";
import type { SectionKey } from "./types";

/**
 * Lightweight React mirror of the storefront PageRenderer, for the generator's
 * live preview. Layout is driven by the `mobile` flag instead of viewport
 * breakpoints so the 390px frame renders like a phone even on a wide screen.
 * Headings, paragraphs and button labels are contentEditable and write back
 * through `onEdit`.
 */

export interface PreviewProduct {
  name: string;
  priceText: string;
  compareText: string;
  imageSrc: string | null;
}

export interface PreviewStrings {
  shuffle: string;
  orderNow: string;
  productNote: string;
  noProduct: string;
  countdownNote: string;
  editHint: string;
}

interface PreviewProps {
  tree: PageTree;
  mobile: boolean;
  dir: "rtl" | "ltr";
  accent: string;
  product: PreviewProduct | null;
  sectionLabels: Record<SectionKey, string>;
  sectionErrors: Partial<Record<SectionKey, string>>;
  strings: PreviewStrings;
  onShuffle: (key: SectionKey) => void;
  onEdit: (elementId: string, prop: string, value: string) => void;
}

type Str = (p: Record<string, unknown> | undefined, k: string) => string;
const str: Str = (p, k) => (typeof p?.[k] === "string" ? (p[k] as string) : "");

function Editable({
  tag,
  value,
  className,
  style,
  onCommit,
  singleLine,
}: {
  tag: string;
  value: string;
  className?: string;
  style?: CSSProperties;
  onCommit: (v: string) => void;
  singleLine?: boolean;
}) {
  return createElement(
    tag,
    {
      key: value,
      contentEditable: true,
      suppressContentEditableWarning: true,
      spellCheck: false,
      style,
      className: cn(
        "cursor-text rounded-md outline-none transition-shadow hover:ring-1 hover:ring-primary/30 focus:ring-2 focus:ring-primary/50",
        className
      ),
      onBlur: (e: { currentTarget: HTMLElement }) => {
        const next = e.currentTarget.innerText.replace(/\s+\n/g, "\n").trim();
        if (next && next !== value) onCommit(next);
        else if (!next) e.currentTarget.innerText = value;
      },
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        if (singleLine && e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      },
    },
    value
  );
}

const HEADING_SIZE: Record<number, [string, string]> = {
  1: ["text-2xl font-bold", "text-4xl font-bold"],
  2: ["text-xl font-bold", "text-3xl font-bold"],
  3: ["text-lg font-semibold", "text-2xl font-semibold"],
  4: ["text-base font-semibold", "text-lg font-semibold"],
};

const ICONS = { truck: Truck, shield: ShieldCheck, check: BadgeCheck, star: Star };

function ElementView({
  element,
  props: p,
}: {
  element: PageElement;
  props: PreviewProps;
}) {
  const { mobile, accent, onEdit, product, strings } = p;
  const ep = element.props;
  const edit = (prop: string) => (v: string) => onEdit(element.id, prop, v);
  const accentBtn: CSSProperties = { backgroundColor: accent, color: "#fff" };

  switch (element.type) {
    case "heading": {
      const level = Math.min(4, Math.max(1, Number(ep?.level) || 2));
      return (
        <Editable
          tag={`h${level}`}
          value={str(ep, "text")}
          singleLine
          className={cn("text-ink", HEADING_SIZE[level][mobile ? 0 : 1])}
          onCommit={edit("text")}
        />
      );
    }
    case "text":
    case "rich_text":
      return (
        <Editable
          tag="p"
          value={str(ep, "text")}
          className={cn(
            "whitespace-pre-line leading-relaxed text-ink-soft",
            element.type === "rich_text" ? (mobile ? "text-base" : "text-lg") : "text-sm"
          )}
          onCommit={edit("text")}
        />
      );
    case "button":
      return (
        <span className="inline-flex min-h-11 w-fit items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold" style={accentBtn}>
          <Editable tag="span" value={str(ep, "label")} singleLine onCommit={edit("label")} />
        </span>
      );
    case "image":
      return str(ep, "src") ? (
        <img src={str(ep, "src")} alt={str(ep, "alt")} className="h-auto w-full rounded-2xl object-cover" />
      ) : null;
    case "gallery": {
      const imgs = Array.isArray(ep?.images) ? (ep.images as string[]) : [];
      return (
        <div className={cn("grid gap-3", mobile ? "grid-cols-2" : "grid-cols-3")}>
          {imgs.map((src, i) => (
            <img key={i} src={src} alt="" className="aspect-square w-full rounded-2xl border border-line object-cover" />
          ))}
        </div>
      );
    }
    case "list": {
      const items = Array.isArray(ep?.items) ? (ep.items as string[]) : [];
      return (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
              <span className="mt-2 size-1.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    }
    case "icon": {
      const Icon = ICONS[str(ep, "name") as keyof typeof ICONS] ?? BadgeCheck;
      return <Icon className="size-8" style={{ color: accent }} aria-hidden />;
    }
    case "testimonial":
      return (
        <figure className="rounded-2xl border border-line bg-paper-raised p-5 shadow-card">
          <blockquote className="whitespace-pre-line text-sm leading-relaxed text-ink">“{str(ep, "quote")}”</blockquote>
          {str(ep, "author") && <figcaption className="mt-3 text-sm font-semibold text-ink-soft">— {str(ep, "author")}</figcaption>}
        </figure>
      );
    case "faq": {
      const items = Array.isArray(ep?.items) ? (ep.items as Array<{ q: string; a: string }>) : [];
      return (
        <div>
          <Editable tag="h3" value={str(ep, "title")} singleLine className="mb-4 text-xl font-semibold text-ink" onCommit={edit("title")} />
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-raised">
            {items.map((item, i) => (
              <details key={i} className="group" open={i === 0}>
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink">
                  {item.q}
                  <ChevronDown className="size-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="px-4 pb-3 text-sm leading-relaxed text-ink-soft">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      );
    }
    case "countdown": {
      const hours = Number(ep?.endsInHours) || 0;
      return (
        <div className="rounded-2xl px-5 py-4 text-center" style={{ backgroundColor: `${accent}14`, border: `1px solid ${accent}33` }}>
          <p className="text-sm font-semibold text-ink">{str(ep, "label")}</p>
          <p className="mt-2 flex justify-center gap-2 text-2xl font-bold tabular-nums" dir="ltr" style={{ color: accent }}>
            <span>{String(hours).padStart(2, "0")}</span>:<span>00</span>:<span>00</span>
          </p>
          <p className="mt-2 text-xs text-ink-muted">{strings.countdownNote}</p>
        </div>
      );
    }
    case "product_card":
      if (!product) return <p className="rounded-xl border border-dashed border-line p-4 text-sm text-ink-muted">{strings.noProduct}</p>;
      return (
        <div className={cn("grid gap-5 rounded-2xl border border-line bg-paper-raised p-5 shadow-card", !mobile && "grid-cols-2")}>
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-zimos-cloud">
            {product.imageSrc ? (
              <img src={product.imageSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="size-10 text-line-strong" aria-hidden />
            )}
          </div>
          <div className="flex flex-col">
            <h3 className="text-xl font-bold text-ink">{product.name}</h3>
            {product.priceText && (
              <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
                <span className="text-2xl font-bold text-ink">{product.priceText}</span>
                {product.compareText && <span className="text-ink-muted line-through">{product.compareText}</span>}
              </p>
            )}
            <span className="mt-auto inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold" style={accentBtn}>
              {strings.orderNow}
            </span>
            <p className="mt-2 text-xs text-ink-muted">{strings.productNote}</p>
          </div>
        </div>
      );
    default:
      return null;
  }
}

function ColumnView({ column, props }: { column: PageColumn; props: PreviewProps }) {
  const span = Math.min(12, Math.max(1, column.span ?? 12));
  return (
    <div className="flex min-w-0 flex-col gap-4" style={props.mobile ? undefined : { gridColumn: `span ${span} / span ${span}` }}>
      {column.elements.map((e) => (
        <ElementView key={e.id} element={e} props={props} />
      ))}
    </div>
  );
}

function SectionView({ section, props }: { section: PageSection; props: PreviewProps }) {
  const key = sectionKeyOf(section.id);
  const error = key ? props.sectionErrors[key] : undefined;
  return (
    <section className={cn("group relative px-4 py-8", !props.mobile && "px-8 py-12", error && "ring-2 ring-inset ring-danger")}>
      {key && (
        <div className="absolute end-2 top-2 z-10 flex items-center gap-1" dir={props.dir}>
          <span className="rounded-full bg-zimos-navy/80 px-2 py-0.5 text-[11px] font-medium text-white">{props.sectionLabels[key]}</span>
          <button
            type="button"
            onClick={() => props.onShuffle(key)}
            title={props.strings.shuffle}
            aria-label={`${props.strings.shuffle}: ${props.sectionLabels[key]}`}
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full border border-line bg-paper-raised text-ink-soft shadow-sm hover:text-primary"
          >
            <Shuffle className="size-3.5" aria-hidden />
          </button>
        </div>
      )}
      {error && <p className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-xs font-medium text-danger">{error}</p>}
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        {section.rows.map((r) => (
          <div
            key={r.id}
            className={props.mobile ? "flex flex-col gap-6" : "grid gap-6"}
            style={props.mobile ? undefined : { gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}
          >
            {r.columns.map((c) => (
              <ColumnView key={c.id} column={c} props={props} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function LandingPreview(props: PreviewProps) {
  return (
    <div
      className={cn(
        "mx-auto overflow-hidden bg-paper",
        props.mobile ? "w-[390px] max-w-full rounded-[32px] border-[10px] border-zimos-navy shadow-card" : "w-full rounded-2xl border border-line"
      )}
    >
      <div dir={props.dir} className="max-h-[78vh] divide-y divide-line overflow-y-auto">
        {props.tree.sections.map((s) => (
          <SectionView key={s.id} section={s} props={props} />
        ))}
      </div>
      <p className="border-t border-line bg-paper-raised px-3 py-2 text-center text-[11px] text-ink-muted">{props.strings.editHint}</p>
    </div>
  );
}
