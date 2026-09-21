import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, type LucideIcon } from "lucide-react";
import { cn } from "@store-builder/ui";
import type { PageElement, PageSection } from "@store-builder/api-client";
import { ELEMENT_SPECS, sectionElements, sectionIcon, sectionLabel } from "./blocks";
import { useEditorLocale } from "./editorLocale";

/**
 * A section as it appears in the outline: a bordered card that summarises the
 * elements inside it. This is deliberately NOT a storefront preview — it is a
 * structural view. In the website editor the real storefront is the canvas
 * beside it, and these cards are its layer list (drag to reorder).
 */

function truncate(value: string, max = 90): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** A one-line gist of an element, pulled from whichever prop carries its text. */
function elementSummary(element: PageElement): string {
  const props = (element.props ?? {}) as Record<string, unknown>;
  const str = (key: string) => (typeof props[key] === "string" ? (props[key] as string) : "");

  switch (element.type) {
    case "heading":
    case "text":
    case "rich_text":
      return truncate(str("text"));
    case "button":
      return truncate([str("label"), str("href") && `→ ${str("href")}`].filter(Boolean).join(" "));
    case "image":
      return str("src") ? truncate(str("alt") || "Image") : "No image yet";
    case "gallery": {
      const n = Array.isArray(props.images) ? props.images.length : 0;
      return truncate([str("title"), `${n} ${n === 1 ? "image" : "images"}`].filter(Boolean).join(" · "));
    }
    case "testimonial":
      return truncate([str("quote") && `“${str("quote")}”`, str("author")].filter(Boolean).join(" — "));
    case "faq":
    case "accordion": {
      const n = Array.isArray(props.items) ? props.items.length : 0;
      return truncate([str("title"), `${n} ${n === 1 ? "row" : "rows"}`].filter(Boolean).join(" · "));
    }
    case "list": {
      const n = Array.isArray(props.items) ? props.items.length : 0;
      return truncate([str("title"), `${n} ${n === 1 ? "item" : "items"}`].filter(Boolean).join(" · "));
    }
    case "product_list":
      return truncate(
        [str("title"), str("source") && `${str("source")}`, props.limit && `${props.limit} items`]
          .filter(Boolean)
          .join(" · ")
      );
    case "collection_list":
      return truncate([str("title"), props.limit && `${props.limit} collections`].filter(Boolean).join(" · "));
    case "product_card":
      return truncate(str("title") || "One product");
    case "countdown":
      return truncate([str("label"), props.endsInHours && `${props.endsInHours}h`].filter(Boolean).join(" · "));
    case "video":
    case "embed":
      return truncate(str("title") || str("url") || "Nothing linked yet");
    case "map":
      return truncate(str("address") || "No address yet");
    case "social_icons": {
      const n = Array.isArray(props.links) ? props.links.length : 0;
      return `${n} ${n === 1 ? "link" : "links"}`;
    }
    case "form":
      return truncate(str("title") || "Form");
    case "spacer":
      return props.height ? `${props.height}px` : "";
    case "icon":
      return truncate(str("name"));
    case "cart":
      return truncate(str("title") || "Cart");
    case "divider":
      return "";
    case "shader_hero":
      return truncate(str("title") || str("subtitle") || "Living hero");
    case "product_3d":
      return truncate(str("title") || str("productId") || "3D product");
    case "orbit_gallery":
      return truncate([str("title"), props.limit && `${props.limit} products`].filter(Boolean).join(" · "));
    case "scroll_story": {
      const n = Array.isArray(props.steps) ? props.steps.length : 0;
      return truncate([str("title"), `${n} ${n === 1 ? "step" : "steps"}`].filter(Boolean).join(" · "));
    }
    case "marquee": {
      const items = Array.isArray(props.items) ? props.items : [];
      // The claims themselves are the gist here — there is no title to show.
      return items.length === 0
        ? "Nothing written yet"
        : truncate(items.filter((item) => typeof item === "string").join(" · "));
    }
    case "comparison": {
      const n = Array.isArray(props.rows) ? props.rows.length : 0;
      return truncate([str("title"), `${n} ${n === 1 ? "row" : "rows"}`].filter(Boolean).join(" · "));
    }
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
  showSummary = true,
}: {
  section: PageSection;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  /** Off for a compact one-line row (the website editor's layer list). */
  showSummary?: boolean;
}) {
  const locale = useEditorLocale();
  const label = sectionLabel(section, locale);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const elements = sectionElements(section);
  const icon = sectionIcon(section);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "rounded-[var(--radius-card)] border bg-paper-raised transition-colors",
        selected ? "border-primary ring-1 ring-primary/30" : "border-line hover:border-primary/50",
        isDragging && "z-10 opacity-80 shadow-lg"
      )}
    >
      <div className={cn("flex items-center gap-1 px-2 py-2", showSummary && "border-b border-line")}>
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${label}`}
          className="cursor-pointer cursor-grab rounded-[0.375rem] p-1.5 text-ink-soft hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>

        <button
          type="button"
          onClick={onSelect}
          className="cursor-pointer flex min-w-0 flex-1 items-center gap-2 rounded-[0.375rem] px-1 py-1 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <NodeIcon icon={icon} className="size-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium text-ink">{label}</span>
        </button>

        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${label}`}
          className="cursor-pointer rounded-[0.375rem] p-1.5 text-ink-soft hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>

      {showSummary && (
        <button
          type="button"
          onClick={onSelect}
          className="cursor-pointer block w-full space-y-1.5 px-4 py-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {elements.length === 0 ? (
            <span className="text-sm text-ink-soft">Empty section</span>
          ) : (
            elements.map((element) => {
              const spec = ELEMENT_SPECS[element.type];
              const summary = elementSummary(element);
              return (
                <span key={element.id} className="flex items-start gap-2 text-sm">
                  <NodeIcon icon={spec.icon} className="mt-0.5 size-3.5 shrink-0 text-ink-soft" />
                  <span className="min-w-0 flex-1">
                    <span className="text-ink-soft">{spec.label}</span>
                    {summary && <span className="ms-2 text-ink">{summary}</span>}
                  </span>
                </span>
              );
            })
          )}
        </button>
      )}
    </div>
  );
}
