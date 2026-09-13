import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, type LucideIcon } from "lucide-react";
import { cn } from "@store-builder/ui";
import type { PageElement, PageSection } from "@store-builder/api-client";
import { fmt, useCommon, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";
import { ELEMENT_SPECS, sectionElements, sectionIcon, sectionLabel, tr } from "./blocks";

const STRINGS = {
  en: {
    reorder: "Reorder {label}",
    deleteSection: "Delete {label}",
    emptySection: "Empty section",
    image: "Image",
    noImage: "No image yet",
    imagesOne: "1 image",
    imagesMany: "{n} images",
    rowsOne: "1 row",
    rowsMany: "{n} rows",
    itemsOne: "1 item",
    itemsMany: "{n} items",
    collections: "{n} collections",
    oneProduct: "One product",
    hours: "{n}h",
    nothingLinked: "Nothing linked yet",
    noAddress: "No address yet",
    linksOne: "1 link",
    linksMany: "{n} links",
    form: "Form",
    cart: "Cart",
  },
  ar: {
    reorder: "إعادة ترتيب {label}",
    deleteSection: "حذف {label}",
    emptySection: "قسم فارغ",
    image: "صورة",
    noImage: "لا توجد صورة بعد",
    imagesOne: "صورة واحدة",
    imagesMany: "عدد الصور: {n}",
    rowsOne: "صف واحد",
    rowsMany: "عدد الصفوف: {n}",
    itemsOne: "عنصر واحد",
    itemsMany: "عدد العناصر: {n}",
    collections: "عدد المجموعات: {n}",
    oneProduct: "منتج واحد",
    hours: "{n} ساعة",
    nothingLinked: "لا يوجد رابط بعد",
    noAddress: "لا يوجد عنوان بعد",
    linksOne: "رابط واحد",
    linksMany: "عدد الروابط: {n}",
    form: "نموذج",
    cart: "سلة التسوق",
  },
} satisfies Messages;

type SummaryText = (typeof STRINGS)["en"];

/**
 * A section as it appears on the canvas: a bordered card that summarises the
 * elements inside it. This is deliberately NOT a storefront preview — it is a
 * structural view, because rendering the real thing is a later phase.
 *
 * Merchant-authored content inside it is rendered with `dir="auto"`, so an
 * English heading on an Arabic dashboard (or vice versa) still reads correctly.
 */

function truncate(value: string, max = 90): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function counted(n: number, one: string, many: string): string {
  return n === 1 ? one : fmt(many, { n });
}

/** Localized label of a select option value, falling back to the raw value. */
function optionLabel(
  type: PageElement["type"],
  key: string,
  value: string,
  locale: Locale
): string {
  const field = ELEMENT_SPECS[type].fields.find((f) => f.key === key);
  if (field?.kind !== "select") return value;
  const option = field.options.find((o) => o.value === value);
  return option ? tr(option.label, locale) : value;
}

/** A one-line gist of an element, pulled from whichever prop carries its text. */
function elementSummary(element: PageElement, t: SummaryText, locale: Locale): string {
  const props = (element.props ?? {}) as Record<string, unknown>;
  const str = (key: string) => (typeof props[key] === "string" ? (props[key] as string) : "");
  const arrow = locale === "ar" ? "←" : "→";

  switch (element.type) {
    case "heading":
    case "text":
    case "rich_text":
      return truncate(str("text"));
    case "button":
      // The href is isolated LTR (U+2066…U+2069) so "/products" doesn't reorder
      // to "products/" next to an Arabic button label.
      return truncate(
        [str("label"), str("href") && `${arrow} \u2066${str("href")}\u2069`].filter(Boolean).join(" ")
      );
    case "image":
      return str("src") ? truncate(str("alt") || t.image) : t.noImage;
    case "gallery": {
      const n = Array.isArray(props.images) ? props.images.length : 0;
      return truncate([str("title"), counted(n, t.imagesOne, t.imagesMany)].filter(Boolean).join(" · "));
    }
    case "testimonial":
      return truncate([str("quote") && `“${str("quote")}”`, str("author")].filter(Boolean).join(" — "));
    case "faq":
    case "accordion": {
      const n = Array.isArray(props.items) ? props.items.length : 0;
      return truncate([str("title"), counted(n, t.rowsOne, t.rowsMany)].filter(Boolean).join(" · "));
    }
    case "list": {
      const n = Array.isArray(props.items) ? props.items.length : 0;
      return truncate([str("title"), counted(n, t.itemsOne, t.itemsMany)].filter(Boolean).join(" · "));
    }
    case "product_list": {
      const limit = typeof props.limit === "number" || typeof props.limit === "string" ? props.limit : "";
      return truncate(
        [
          str("title"),
          str("source") && optionLabel(element.type, "source", str("source"), locale),
          limit !== "" && fmt(t.itemsMany, { n: limit }),
        ]
          .filter(Boolean)
          .join(" · ")
      );
    }
    case "collection_list": {
      const limit = typeof props.limit === "number" || typeof props.limit === "string" ? props.limit : "";
      return truncate(
        [str("title"), limit !== "" && fmt(t.collections, { n: limit })].filter(Boolean).join(" · ")
      );
    }
    case "product_card":
      return truncate(str("title") || t.oneProduct);
    case "countdown": {
      const hours =
        typeof props.endsInHours === "number" || typeof props.endsInHours === "string"
          ? props.endsInHours
          : "";
      return truncate([str("label"), hours !== "" && fmt(t.hours, { n: hours })].filter(Boolean).join(" · "));
    }
    case "video":
    case "embed":
      return truncate(str("title") || str("url") || t.nothingLinked);
    case "map":
      return truncate(str("address") || t.noAddress);
    case "social_icons": {
      const n = Array.isArray(props.links) ? props.links.length : 0;
      return counted(n, t.linksOne, t.linksMany);
    }
    case "form":
      return truncate(str("title") || t.form);
    case "spacer":
      return props.height ? `${String(props.height)}px` : "";
    case "icon":
      return truncate(str("name"));
    case "cart":
      return truncate(str("title") || t.cart);
    case "divider":
      return "";
  }
}

/**
 * Renders a lucide icon passed as a value. Aliasing `spec.icon` to a
 * capitalised local inside a `.map` callback trips oxlint's static-components
 * rule; taking it as a prop keeps the alias at module scope.
 */
function NodeIcon({ icon: Glyph, className }: { icon: LucideIcon; className?: string }) {
  return <Glyph className={className} aria-hidden />;
}

export function SectionCard({
  section,
  selected,
  onSelect,
  onDelete,
}: {
  section: PageSection;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  // The list is vertical-only (restrictToVerticalAxis), and CSS.Translate uses
  // the pointer delta directly, so nothing here depends on text direction.
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const elements = sectionElements(section);
  const icon = sectionIcon(section);
  const label = sectionLabel(section, locale);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "rounded-2xl border bg-paper-raised shadow-card transition-colors",
        selected ? "border-primary ring-2 ring-primary/25" : "border-line hover:border-primary/50",
        isDragging && "z-10 opacity-80 shadow-pop"
      )}
    >
      <div className="flex items-center gap-1 border-b border-line px-2 py-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={fmt(t.reorder, { label })}
          title={fmt(t.reorder, { label })}
          className="cursor-grab rounded-md p-1.5 text-ink-muted hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>

        <button
          type="button"
          onClick={onSelect}
          className="cursor-pointer flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary-soft">
            <NodeIcon icon={icon} className="size-3.5 text-primary" />
          </span>
          <span className="truncate text-sm font-semibold text-ink">{label}</span>
        </button>

        <button
          type="button"
          onClick={onDelete}
          aria-label={fmt(t.deleteSection, { label })}
          title={c.delete}
          className="cursor-pointer rounded-md p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>

      <button
        type="button"
        onClick={onSelect}
        className="cursor-pointer block w-full space-y-1.5 px-4 py-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {elements.length === 0 ? (
          <span className="text-sm text-ink-soft">{t.emptySection}</span>
        ) : (
          elements.map((element) => {
            const spec = ELEMENT_SPECS[element.type];
            const summary = elementSummary(element, t, locale);
            return (
              <span key={element.id} className="flex items-start gap-2 text-sm">
                <NodeIcon icon={spec.icon} className="mt-0.5 size-3.5 shrink-0 text-ink-muted" />
                <span className="min-w-0 flex-1 break-words">
                  <span className="text-ink-soft">{tr(spec.label, locale)}</span>
                  {summary && (
                    <bdi dir="auto" className="ms-2 text-ink">
                      {summary}
                    </bdi>
                  )}
                </span>
              </span>
            );
          })
        )}
      </button>
    </div>
  );
}
