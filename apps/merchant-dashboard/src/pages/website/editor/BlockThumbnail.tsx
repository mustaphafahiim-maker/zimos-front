import { memo, type ReactNode } from "react";
import type { PageElementType } from "@store-builder/api-client";
import { BLOCK_PRESETS, type PresetRow } from "./blocks";

/**
 * A little schematic of a block preset, drawn from the element types it drops
 * onto the page — no images, so it can never disagree with what the preset
 * actually contains. Each element type has one fixed sketch; a preset is its
 * sketches stacked in order, like the section it creates — or, for a preset
 * laid out over columns, the same sketches on the same 12-column grid the
 * storefront draws, so the thumbnail shows the shape the merchant will get.
 */

const bar = "rounded-full bg-ink-soft/25";
const line = (width: string) => <span className={`block h-1 ${bar}`} style={{ width }} />;
const box = "rounded-[0.25rem] bg-line";

function Sketch({ type }: { type: PageElementType }): ReactNode {
  switch (type) {
    case "heading":
      return <span className="mx-auto block h-2 w-3/5 rounded-full bg-ink-soft/55" />;
    case "text":
      return <span className="flex flex-col items-center gap-0.5">{line("80%")}{line("60%")}</span>;
    case "rich_text":
      return (
        <span className="flex flex-col items-center gap-0.5">
          {line("85%")}
          {line("85%")}
          {line("55%")}
        </span>
      );
    case "button":
      return <span className="mx-auto block h-2.5 w-1/4 rounded-full bg-primary/70" />;
    case "image":
      return (
        <span className={`relative mx-auto block h-7 w-3/4 overflow-hidden ${box}`}>
          <span className="absolute bottom-0 start-1 size-0 border-x-[8px] border-b-[10px] border-x-transparent border-b-ink-soft/30" />
          <span className="absolute end-2 top-1.5 size-1.5 rounded-full bg-ink-soft/30" />
        </span>
      );
    case "gallery":
      return (
        <span className="mx-auto grid w-4/5 grid-cols-3 gap-0.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={`block h-3 ${box}`} />
          ))}
        </span>
      );
    case "video":
    case "embed":
      return (
        <span className={`relative mx-auto flex h-7 w-3/4 items-center justify-center ${box}`}>
          {type === "video" ? (
            <span className="size-0 border-y-[5px] border-s-[8px] border-y-transparent border-s-ink-soft/50" />
          ) : (
            <span className="font-mono text-[0.5rem] leading-none text-ink-soft/70">&lt;/&gt;</span>
          )}
        </span>
      );
    case "spacer":
      return <span className="block h-2" />;
    case "divider":
      return <span className="mx-auto block h-px w-4/5 bg-ink-soft/40" />;
    case "icon":
      return <span className="mx-auto block size-3 rounded-full bg-primary/50" />;
    case "list":
      return (
        <span className="mx-auto flex w-3/5 flex-col gap-0.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="size-1 shrink-0 rounded-full bg-primary/60" />
              {line("100%")}
            </span>
          ))}
        </span>
      );
    case "accordion":
    case "faq":
      return (
        <span className="mx-auto flex w-4/5 flex-col gap-0.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="flex h-2 items-center justify-between rounded-[0.2rem] border border-line px-0.5">
              <span className={`block h-0.5 w-1/2 ${bar}`} />
              <span className="size-0.5 rounded-full bg-ink-soft/50" />
            </span>
          ))}
        </span>
      );
    case "testimonial":
      return (
        <span className="mx-auto flex w-3/4 items-center gap-1 rounded-[0.25rem] border border-line p-1">
          <span className="size-2.5 shrink-0 rounded-full bg-accent/60" />
          <span className="flex flex-1 flex-col gap-0.5">{line("100%")}{line("70%")}</span>
        </span>
      );
    case "countdown":
      return (
        <span className="mx-auto flex justify-center gap-0.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="block h-3.5 w-3 rounded-[0.2rem] bg-accent/50" />
          ))}
        </span>
      );
    case "form":
      return (
        <span className="mx-auto flex w-3/5 flex-col gap-0.5">
          <span className="block h-2 rounded-[0.2rem] border border-line-strong/50" />
          <span className="block h-2 rounded-[0.2rem] border border-line-strong/50" />
          <span className="block h-2 w-1/2 rounded-full bg-primary/70" />
        </span>
      );
    case "map":
      return (
        <span className={`relative mx-auto block h-7 w-3/4 ${box}`}>
          <span className="absolute start-1/2 top-2 size-2 -translate-x-1/2 rounded-full bg-danger/70 rtl:translate-x-1/2" />
        </span>
      );
    case "social_icons":
      return (
        <span className="mx-auto flex justify-center gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="size-2 rounded-full bg-ink-soft/40" />
          ))}
        </span>
      );
    case "product_card":
      return (
        <span className="mx-auto flex w-3/4 items-center gap-1">
          <span className={`block h-7 w-7 shrink-0 ${box}`} />
          <span className="flex flex-1 flex-col gap-0.5">
            {line("90%")}
            {line("50%")}
            <span className="block h-2 w-1/2 rounded-full bg-primary/70" />
          </span>
        </span>
      );
    case "product_list":
    case "collection_list":
    case "orbit_gallery":
      return (
        <span className="mx-auto flex w-4/5 items-end justify-center gap-0.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="flex flex-1 flex-col gap-0.5">
              <span
                className={`block ${box}`}
                style={{
                  height: type === "orbit_gallery" ? [14, 20, 20, 14][i] : type === "collection_list" ? 16 : 20,
                }}
              />
              {type === "product_list" && <span className={`block h-0.5 ${bar}`} />}
            </span>
          ))}
        </span>
      );
    case "cart":
      return (
        <span className="mx-auto flex w-3/4 flex-col gap-0.5">
          {[0, 1].map((i) => (
            <span key={i} className="flex items-center gap-1">
              <span className={`block size-2.5 shrink-0 ${box}`} />
              {line("100%")}
            </span>
          ))}
        </span>
      );
    case "shader_hero":
      return (
        <span className="mx-auto flex h-9 w-full flex-col items-center justify-center gap-0.5 rounded-[0.25rem] bg-linear-to-br from-primary/60 to-accent/60">
          <span className="block h-1.5 w-1/2 rounded-full bg-paper-raised/80" />
          <span className="block h-1 w-1/3 rounded-full bg-paper-raised/60" />
        </span>
      );
    case "product_3d":
      return (
        <span className="relative mx-auto flex h-8 w-3/4 items-center justify-center">
          <span className="absolute h-3 w-full rounded-[50%] border border-ink-soft/30" />
          <span className="size-5 rounded-[0.3rem] bg-primary/45 shadow-sm" />
        </span>
      );
    case "scroll_story":
      return (
        <span className="mx-auto flex w-4/5 flex-col gap-0.5">
          {[0, 1].map((i) => (
            <span key={i} className={`flex items-center gap-1 ${i === 1 ? "flex-row-reverse" : ""}`}>
              <span className={`block h-4 w-1/2 ${box}`} />
              <span className="flex flex-1 flex-col gap-0.5">{line("100%")}{line("60%")}</span>
            </span>
          ))}
        </span>
      );
    case "marquee":
      return (
        <span className="flex gap-0.5 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="block h-2 w-1/3 shrink-0 rounded-full bg-primary/35" />
          ))}
        </span>
      );
    case "comparison":
      return (
        <span className="mx-auto flex w-4/5 flex-col gap-px">
          {[0, 1, 2].map((i) => (
            <span key={i} className="grid grid-cols-3 gap-0.5">
              <span className={`block h-1.5 ${bar}`} />
              <span className="block h-1.5 rounded-full bg-success/50" />
              <span className="block h-1.5 rounded-full bg-ink-soft/15" />
            </span>
          ))}
        </span>
      );
    default:
      return <span className={`block h-2 ${bar}`} />;
  }
}

/**
 * The strong grounds show on the thumbnail too, or a brand-colour band and a
 * plain one would look the same in the library. Anything else keeps the paper.
 */
const GROUND_CLASS: Record<string, string> = {
  primary: "bg-primary/15",
  ink: "bg-ink/70",
  "primary-soft": "bg-primary-soft",
  paper: "bg-paper",
};

function ground(settings: Record<string, unknown> | undefined): string {
  const background = settings?.background;
  return typeof background === "string" ? (GROUND_CLASS[background] ?? "") : "";
}

/**
 * The one-node version of a sketch, for an element inside a column. A column
 * is a third or a quarter of the thumbnail wide, so the detail above would
 * not read anyway — and the library draws sixty of these at once, so every
 * span counts (the editor's screen tests render the whole library in jsdom).
 */
function MiniSketch({ type }: { type: PageElementType }): ReactNode {
  switch (type) {
    case "heading":
      return <span className="block h-1.5 w-4/5 rounded-full bg-ink-soft/55" />;
    case "text":
    case "rich_text":
      return <span className={`block h-1 w-full ${bar}`} />;
    case "button":
      return <span className="block h-2 w-2/5 rounded-full bg-primary/70" />;
    case "icon":
      return <span className="block size-2.5 rounded-full bg-primary/50" />;
    case "image":
    case "gallery":
    case "video":
    case "embed":
    case "map":
    case "scroll_story":
      return <span className={`block h-5 w-full ${box}`} />;
    case "list":
      return <span className="block h-3 w-4/5 rounded-[0.2rem] border-s-2 border-primary/60 bg-ink-soft/10" />;
    case "countdown":
      return <span className="block h-2.5 w-1/2 rounded-[0.2rem] bg-accent/50" />;
    case "marquee":
      return <span className="block h-2 w-full rounded-full bg-primary/35" />;
    case "social_icons":
      return <span className="block h-2 w-1/2 rounded-full bg-ink-soft/40" />;
    case "divider":
      return <span className="block h-px w-full bg-ink-soft/40" />;
    case "spacer":
      return <span className="block h-1" />;
    default:
      // Cards and tables — a testimonial, an FAQ, a form, a product — are an
      // outlined panel.
      return <span className="block h-4 w-full rounded-[0.25rem] border border-line" />;
  }
}

/** Tailwind can't build a class from a runtime number, so map the twelve spans. */
const SPAN_CLASS: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
  5: "col-span-5",
  6: "col-span-6",
  7: "col-span-7",
  8: "col-span-8",
  9: "col-span-9",
  10: "col-span-10",
  11: "col-span-11",
  12: "col-span-12",
};

/** One column's sketches; a card surface gets the outline it has on the store. */
function ColumnSketch({ column }: { column: PresetRow["columns"][number] }) {
  const card = column.settings?.surface === "card";
  const centred = column.settings?.align === "center";
  return (
    <span
      className={`flex min-w-0 flex-col justify-center gap-0.5 ${SPAN_CLASS[column.span] ?? "col-span-12"} ${
        centred ? "items-center" : ""
      } ${card ? "rounded-[0.25rem] border border-line p-0.5" : ""}`}
    >
      {column.elements.slice(0, 4).map((type, i) => (
        <MiniSketch key={`${type}-${i}`} type={type} />
      ))}
    </span>
  );
}

/**
 * Memoised: the library draws one of these per preset, and every keystroke
 * in the editor would otherwise redraw all of them. Their props come straight
 * off BLOCK_PRESETS, so they are the same objects every render.
 */
export const BlockThumbnail = memo(function BlockThumbnail({
  elements,
  rows,
  settings,
}: {
  elements: PageElementType[];
  /**
   * The column layout, when the preset has one. The library hands this
   * component the preset's own `elements` array, so when the layout isn't
   * passed it is looked up from that same array — by identity, not by
   * contents, since two presets may share a flattened shape.
   */
  rows?: PresetRow[];
  settings?: Record<string, unknown>;
}) {
  const preset = rows === undefined ? BLOCK_PRESETS.find((p) => p.elements === elements) : undefined;
  const layout = rows ?? preset?.rows;
  const look = ground(settings ?? preset?.settings);

  return (
    <span
      aria-hidden
      className={`flex h-20 w-full flex-col justify-center gap-1 overflow-hidden rounded-[0.375rem] border border-line px-2 py-1.5 ${look || "bg-paper-raised"}`}
    >
      {layout
        ? layout.map((row, r) => (
            <span key={r} className="grid grid-cols-12 gap-1">
              {row.columns.map((column, c) => (
                <ColumnSketch key={c} column={column} />
              ))}
            </span>
          ))
        : elements.map((type, i) => <Sketch key={`${type}-${i}`} type={type} />)}
    </span>
  );
});
