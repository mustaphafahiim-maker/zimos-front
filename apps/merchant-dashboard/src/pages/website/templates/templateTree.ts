import type { PageElement, PageElementType, PageRow, PageSection, PageTree } from "@store-builder/api-client";
import { BLOCK_PRESETS, ELEMENT_SPECS, type ColumnWithSettings, type RowWithSettings } from "../editor/blocks";

/**
 * How a store template's pages are written down, and how they become the
 * page trees the server stores (modules/pages/pageTree.js).
 *
 * A template's page is a list of sections, each one either a block of the
 * editor's own library with other words in it (`fromPreset`), a full-width
 * band (`band`), or a layout written out here (`custom`). Building a page
 * (`buildPage`) lays every element over its type's default props, exactly as
 * "Add a block" does, and names every node by its place in the page — so the
 * same definitions always give the same tree, byte for byte, and a section
 * that keeps a library block's shape is named after that block in the editor.
 */

type Props = Record<string, unknown>;

export interface ElementDraft {
  type: PageElementType;
  props?: Props;
}

export interface ColumnDraft {
  span: number;
  elements: ElementDraft[];
  settings?: Props;
}

export interface RowDraft {
  columns: ColumnDraft[];
  settings?: Props;
}

export interface SectionDraft {
  /** A short name for the section, part of every id inside it. */
  key: string;
  rows: RowDraft[];
  settings?: Props;
}

export const el = (type: PageElementType, props?: Props): ElementDraft => ({ type, props });
export const col = (span: number, elements: ElementDraft[], settings?: Props): ColumnDraft => ({ span, elements, settings });
export const row = (columns: ColumnDraft[], settings?: Props): RowDraft => ({ columns, settings });

/** A section laid out here rather than taken from the library. */
export function custom(key: string, rows: RowDraft[], settings?: Props): SectionDraft {
  return { key, rows, settings };
}

/** A full-width band: one showcase element in a section set the way the library's own bands are. */
export function band(type: PageElementType, props: Props, key: string = type.replace(/_/g, "-")): SectionDraft {
  return { key, rows: [row([col(12, [el(type, props)])])], settings: { width: "full", padding: "tight" } };
}

/**
 * A block of the editor's library with a template's own words: `content` is
 * laid over the block's starting props element by element, in the order the
 * block lists them (row by row, column by column). An entry left out keeps
 * the block's own starting copy. `settings` replaces the block's section
 * settings; left out, the block's own stay.
 */
export function fromPreset(
  presetKey: string,
  content: Array<Props | undefined> = [],
  options: { key?: string; settings?: Props } = {}
): SectionDraft {
  const preset = BLOCK_PRESETS.find((p) => p.key === presetKey);
  if (!preset) throw new Error(`Unknown block "${presetKey}"`);

  let index = 0;
  const elements = (types: PageElementType[], own: Array<Props | undefined> | undefined): ElementDraft[] =>
    types.map((type, i) => el(type, { ...own?.[i], ...content[index++] }));

  const rows: RowDraft[] = preset.rows
    ? preset.rows.map((r) => row(r.columns.map((c) => col(c.span, elements(c.elements, c.content), c.settings)), r.settings))
    : [row([col(12, elements(preset.elements, preset.content))])];

  if (content.length > index) {
    throw new Error(`Block "${presetKey}" has ${index} elements, but ${content.length} were written for it`);
  }
  return { key: options.key ?? presetKey, rows, settings: options.settings ?? preset.settings };
}

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** A page's tree, every node named by its place: `<page>-<n>-<section>-r1-c2-e1`. */
export function buildPage(pageKey: string, sections: SectionDraft[]): PageTree {
  const built: PageSection[] = sections.map((draft, s) => {
    const base = `${pageKey}-${s + 1}-${draft.key}`;
    const rows: PageRow[] = draft.rows.map((r, ri) => {
      const rowId = `${base}-r${ri + 1}`;
      const next: RowWithSettings = {
        id: rowId,
        type: "row",
        columns: r.columns.map((c, ci) => {
          const colId = `${rowId}-c${ci + 1}`;
          const column: ColumnWithSettings = {
            id: colId,
            type: "column",
            span: c.span,
            elements: c.elements.map((e, ei): PageElement => ({
              id: `${colId}-e${ei + 1}`,
              type: e.type,
              props: copy({ ...ELEMENT_SPECS[e.type].defaultProps, ...e.props }),
            })),
          };
          if (c.settings) column.settings = copy(c.settings);
          return column;
        }),
      };
      if (r.settings) next.settings = copy(r.settings);
      return next;
    });
    const section: PageSection = { id: base, type: "section", rows };
    if (draft.settings) section.settings = copy(draft.settings);
    return section;
  });
  return { version: 1, sections: built };
}
