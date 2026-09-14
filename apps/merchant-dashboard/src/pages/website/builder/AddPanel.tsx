import { useMemo, useState, type ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Plus, Search } from "lucide-react";
import { cn } from "@store-builder/ui";
import { SECTION_GROUPS, SECTION_LIBRARY, type ElementType, type RendererLocale, type SectionPreset } from "@store-builder/store-renderer";
import { fmt } from "@/i18n/LocaleContext";
import { ELEMENT_LABELS, ELEMENT_PALETTE } from "./elementLibrary";
import { useBuilderT } from "./strings";

export type DragData = { kind: "section"; presetId: string; label: string } | { kind: "element"; elementType: ElementType; label: string };

/* ---- CSS schematics: a tiny wireframe of each preset --------------------- */

const line = (w: string, extra = "") => <span className={cn("block h-1 rounded-full bg-ink/20", extra)} style={{ width: w }} />;
const pill = (extra = "") => <span className={cn("block h-2 w-8 rounded-full bg-primary/80", extra)} />;
const img = (extra = "") => <span className={cn("block rounded bg-primary/15", extra)} />;

function Schematic({ id }: { id: string }) {
  let body: ReactNode;
  switch (id) {
    case "announcement-bar":
      body = (
        <div className="flex h-full flex-col">
          <div className="flex h-4 items-center justify-center bg-primary/80">{line("50%", "bg-white/80")}</div>
          <div className="flex-1" />
        </div>
      );
      break;
    case "hero-image":
      body = (
        <div className="flex h-full flex-col items-center justify-center gap-1 bg-ink/60">
          {line("60%", "bg-white/80 h-1.5")}
          {line("40%", "bg-white/50")}
          <div className="mt-1 flex gap-1">
            {pill()}
            {pill("bg-white/70")}
          </div>
        </div>
      );
      break;
    case "hero-split":
      body = (
        <div className="grid h-full grid-cols-2 gap-2 p-2">
          <div className="flex flex-col justify-center gap-1">
            {line("90%", "h-1.5 bg-ink/40")}
            {line("70%")}
            {pill("mt-1")}
          </div>
          {img("h-full")}
        </div>
      );
      break;
    case "hero-centered":
    case "cta-band":
      body = (
        <div className={cn("flex h-full flex-col items-center justify-center gap-1", id === "cta-band" && "bg-primary/20")}>
          {line("60%", "h-1.5 bg-ink/40")}
          {line("45%")}
          {pill("mt-1")}
        </div>
      );
      break;
    case "hero-poster":
    case "video":
      body = (
        <div className="flex h-full flex-col items-center gap-1 p-2">
          {line("40%", "bg-ink/40")}
          <div className="flex w-full flex-1 items-center justify-center rounded bg-ink/70">
            <span className="size-3 rounded-full bg-white/80" />
          </div>
        </div>
      );
      break;
    case "featured-product":
      body = (
        <div className="grid h-full grid-cols-2 gap-2 p-2">
          {img("h-full")}
          <div className="flex flex-col gap-1">
            {line("80%", "bg-ink/40")}
            <span className="h-2 rounded border border-ink/15" />
            <span className="h-2 rounded border border-ink/15" />
            {pill("w-full")}
          </div>
        </div>
      );
      break;
    case "product-grid":
    case "testimonials":
    case "contact-info":
    case "benefits": {
      const n = id === "testimonials" ? 3 : 4;
      body = (
        <div className="flex h-full flex-col gap-1.5 p-2">
          {line("35%", "mx-auto bg-ink/40")}
          <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${n},1fr)` }}>
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className="flex flex-col gap-0.5 rounded border border-ink/10 p-0.5">
                {id === "product-grid" ? img("flex-1") : <span className="size-2 rounded-full bg-primary/40" />}
                {line("80%")}
              </div>
            ))}
          </div>
        </div>
      );
      break;
    }
    case "collection-list":
    case "gallery":
    case "logo-strip": {
      const n = id === "gallery" ? 6 : id === "logo-strip" ? 5 : 3;
      body = (
        <div className="flex h-full flex-col gap-1.5 p-2">
          {line("35%", "mx-auto bg-ink/40")}
          <div className={cn("grid flex-1 gap-1", id === "logo-strip" && "items-center")} style={{ gridTemplateColumns: `repeat(${id === "gallery" ? 3 : n},1fr)` }}>
            {Array.from({ length: n }, (_, i) => (
              <span key={i} className={cn("block rounded", id === "collection-list" ? "bg-primary/40" : id === "logo-strip" ? "h-2 bg-ink/20" : "bg-primary/15")} />
            ))}
          </div>
        </div>
      );
      break;
    }
    case "image-text":
    case "text-image":
      body = (
        <div className={cn("flex h-full gap-2 p-2", id === "text-image" && "flex-row-reverse")}>
          {img("h-full w-1/2")}
          <div className="flex flex-1 flex-col justify-center gap-1">
            {line("80%", "bg-ink/40")}
            {line("90%")}
            {line("60%")}
          </div>
        </div>
      );
      break;
    case "how-it-works":
    case "trust-badges":
      body = (
        <div className="flex h-full items-center justify-around p-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className={cn("flex size-4 items-center justify-center rounded-full text-[8px] font-bold", id === "how-it-works" ? "bg-primary/80 text-white" : "bg-primary/25")}>
                {id === "how-it-works" ? i : ""}
              </span>
              {line("1.5rem")}
            </div>
          ))}
        </div>
      );
      break;
    case "faq":
      body = (
        <div className="flex h-full flex-col justify-center gap-1 p-2">
          {[1, 2, 3].map((i) => (
            <span key={i} className="flex h-2.5 items-center justify-between rounded border border-ink/15 px-1">
              {line("50%")}
              <span className="text-[8px] leading-none text-ink/40">+</span>
            </span>
          ))}
        </div>
      );
      break;
    case "countdown":
      body = (
        <div className="flex h-full flex-col items-center justify-center gap-1.5">
          {line("40%", "bg-ink/40")}
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className="size-4 rounded bg-primary/70" />
            ))}
          </div>
        </div>
      );
      break;
    case "whatsapp-contact":
    case "map-address":
      body = (
        <div className="flex h-full items-center justify-center gap-2 p-2">
          <span className={cn("size-5 rounded-full", id === "whatsapp-contact" ? "bg-[#25d366]" : "bg-primary/60")} />
          <div className="flex w-1/2 flex-col gap-1">
            {line("90%", "bg-ink/40")}
            {line("70%")}
          </div>
        </div>
      );
      break;
    case "size-guide":
      body = (
        <div className="grid h-full grid-cols-3 gap-px p-2">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className={cn("rounded-sm", i < 3 ? "bg-ink/25" : "bg-ink/10")} />
          ))}
        </div>
      );
      break;
    case "spacer":
      body = <div className="m-2 h-[calc(100%-1rem)] rounded border border-dashed border-ink/25" />;
      break;
    case "divider":
      body = <div className="flex h-full items-center px-3">{line("100%", "h-px")}</div>;
      break;
    default:
      body = (
        <div className="flex h-full flex-col justify-center gap-1 p-3">
          {line("50%", "bg-ink/40")}
          {line("90%")}
          {line("80%")}
        </div>
      );
  }
  return <div className="aspect-[16/9] w-full overflow-hidden rounded-md border border-line bg-white dark:bg-paper">{body}</div>;
}

function PresetCard({ preset, locale, onAdd }: { preset: SectionPreset; locale: RendererLocale; onAdd: () => void }) {
  const t = useBuilderT();
  const name = preset.label[locale];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `preset:${preset.id}`, data: { kind: "section", presetId: preset.id, label: name } satisfies DragData });
  return (
    <li className={cn("group relative rounded-lg border border-line bg-paper-raised p-1.5 transition-shadow hover:border-[#2563eb]/50 hover:shadow-card", isDragging && "opacity-40")}>
      <div ref={setNodeRef} {...listeners} {...attributes} role="button" aria-roledescription="draggable" aria-label={name} className="cursor-grab touch-none active:cursor-grabbing">
        <Schematic id={preset.id} />
        <p className="mt-1 truncate text-xs font-semibold text-ink" title={preset.thumbnail[locale]}>
          {name}
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        aria-label={fmt(t.addSectionAria, { name })}
        title={fmt(t.addSectionAria, { name })}
        className="absolute end-2 top-2 flex size-6 cursor-pointer items-center justify-center rounded-full bg-[#2563eb] text-white opacity-0 shadow transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </li>
  );
}

function ElementChip({ type, locale, canAdd, onAdd }: { type: ElementType; locale: RendererLocale; canAdd: boolean; onAdd: () => void }) {
  const t = useBuilderT();
  const name = ELEMENT_LABELS[type][locale];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `element:${type}`, data: { kind: "element", elementType: type, label: name } satisfies DragData });
  return (
    <li className={cn("flex items-center rounded-lg border border-line bg-paper-raised", isDragging && "opacity-40")}>
      <span ref={setNodeRef} {...listeners} {...attributes} role="button" aria-label={name} className="min-w-0 flex-1 cursor-grab touch-none truncate px-2 py-1.5 text-xs font-medium text-ink active:cursor-grabbing">
        {name}
      </span>
      <button
        type="button"
        disabled={!canAdd}
        onClick={onAdd}
        aria-label={fmt(t.addElementAria, { name })}
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-e-lg text-[#2563eb] hover:bg-[#2563eb]/10 disabled:cursor-not-allowed disabled:text-ink-muted disabled:hover:bg-transparent"
      >
        <Plus className="size-3.5" aria-hidden />
      </button>
    </li>
  );
}

export function AddPanel({
  uiLocale,
  canAddElement,
  onAddSection,
  onAddElement,
}: {
  uiLocale: RendererLocale;
  canAddElement: boolean;
  onAddSection: (presetId: string) => void;
  onAddElement: (type: ElementType) => void;
}) {
  const t = useBuilderT();
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (p: SectionPreset) => !q || [p.label.ar, p.label.en, p.thumbnail.ar, p.thumbnail.en].some((s) => s.toLowerCase().includes(q));
    return SECTION_GROUPS.map((g) => ({ ...g, presets: SECTION_LIBRARY.filter((p) => p.group === g.id && match(p)) })).filter((g) => g.presets.length > 0);
  }, [query]);

  return (
    <div className="space-y-4 p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchSections}
          aria-label={t.searchSections}
          className="w-full rounded-lg border border-line bg-paper py-1.5 pe-2 ps-8 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        />
      </div>
      <p className="text-xs text-ink-soft">{t.dragToCanvas}</p>
      {groups.length === 0 && <p className="text-center text-sm text-ink-muted">{t.noResults}</p>}
      {groups.map((g) => (
        <section key={g.id}>
          <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">{g.label[uiLocale]}</h3>
          <ul className="grid grid-cols-2 gap-2">
            {g.presets.map((p) => (
              <PresetCard key={p.id} preset={p} locale={uiLocale} onAdd={() => onAddSection(p.id)} />
            ))}
          </ul>
        </section>
      ))}
      <section className="border-t border-line pt-3">
        <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-muted">{t.elementsTitle}</h3>
        <p className="mb-2 text-xs text-ink-soft">{t.elementsHint}</p>
        <ul className="grid grid-cols-2 gap-1.5">
          {ELEMENT_PALETTE.map((type) => (
            <ElementChip key={type} type={type} locale={uiLocale} canAdd={canAddElement} onAdd={() => onAddElement(type)} />
          ))}
        </ul>
      </section>
    </div>
  );
}
