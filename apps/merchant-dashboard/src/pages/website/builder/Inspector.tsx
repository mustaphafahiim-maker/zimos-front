import type { Dispatch, ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, MousePointerClick, Trash2 } from "lucide-react";
import { cn } from "@store-builder/ui";
import {
  ROW_LAYOUTS,
  SECTION_PADDINGS,
  SECTION_TONES,
  SECTION_WIDTHS,
  type NodePath,
  type RendererLocale,
  type Tree,
} from "@store-builder/store-renderer";
import { COLUMN_PRESETS, resolvePath, sectionLabel, type EditorAction } from "./editorState";
import { ELEMENT_FIELDS, ELEMENT_LABELS, TABLE_FIELDS } from "./elementLibrary";
import { ElementFieldControl, Field, NumberInput, Segmented, SelectInput, Switch, TextInput } from "./fields";
import { ImageField } from "../editor/ImageField";
import type { CatalogData } from "./StoreChrome";
import { useBuilderT } from "./strings";

const str = (v: unknown) => (typeof v === "string" ? v : "");

function Block({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="space-y-3 border-b border-line px-3 py-3">
      {title && <h3 className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">{title}</h3>}
      {children}
    </div>
  );
}

function NodeList({ items, onSelect }: { items: Array<{ path: string; label: string }>; onSelect: (path: string) => void }) {
  return (
    <ul className="space-y-1">
      {items.map((i) => (
        <li key={i.path}>
          <button type="button" onClick={() => onSelect(i.path)} className="flex w-full cursor-pointer items-center justify-between rounded-md border border-line px-2 py-1.5 text-start text-xs text-ink hover:border-primary hover:text-primary">
            <span dir="auto" className="truncate">
              {i.label}
            </span>
            <ChevronRight className="size-3.5 shrink-0 text-ink-muted rtl:rotate-180" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Inspector({
  tree,
  selection,
  dispatch,
  pages,
  catalog,
  uiLocale,
  onDelete,
  onContentEdited,
}: {
  tree: Tree | undefined;
  selection: NodePath | null;
  dispatch: Dispatch<EditorAction>;
  pages: Array<{ title: string; path: string }>;
  catalog: CatalogData;
  uiLocale: RendererLocale;
  onDelete: (path: NodePath) => void;
  onContentEdited: () => void;
}) {
  const t = useBuilderT();
  const r = resolvePath(tree, selection);

  if (!tree || !selection || !r.section) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-ink-soft">
        <span className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary">
          <MousePointerClick className="size-5" aria-hidden />
        </span>
        <p>{t.nothingSelected}</p>
      </div>
    );
  }

  const section = r.section;
  const sPath = section.id;
  const select = (path: string | null) => dispatch({ type: "select", path });
  const settings = (path: string, patch: Record<string, unknown>, group?: string) => dispatch({ type: "updateSettings", path, patch, group, at: Date.now() });

  const crumbs: Array<{ path: string; label: string }> = [{ path: sPath, label: sectionLabel(section) }];
  if (r.row) crumbs.push({ path: `${sPath}/${r.row.id}`, label: t.kindRow });
  if (r.row && r.column) crumbs.push({ path: `${sPath}/${r.row.id}/${r.column.id}`, label: t.kindColumn });
  if (r.element) crumbs.push({ path: selection, label: ELEMENT_LABELS[r.element.type][uiLocale] });
  const title = crumbs[crumbs.length - 1].label;

  let body: ReactNode = null;

  if (r.kind === "section") {
    const s = section.settings ?? {};
    body = (
      <>
        <Block>
          <Field label={t.sectionLabel}>
            <TextInput value={str(s.label)} placeholder={sectionLabel({ ...section, settings: { ...s, label: "" } })} onChange={(v) => settings(sPath, { label: v.slice(0, 60) }, `${sPath}:label`)} />
          </Field>
          {str(s.variant) && (
            <p className="text-xs text-ink-soft">
              {t.variantLabel}: <bdi className="rounded bg-line px-1.5 py-0.5 font-mono text-[11px]">{str(s.variant)}</bdi>
            </p>
          )}
          <Field label={t.tone}>
            <SelectInput
              value={str(s.tone) || "default"}
              options={SECTION_TONES.map((tone) => ({
                value: tone,
                label: { default: t.toneDefault, surface: t.toneSurface, soft: t.toneSoft, primary: t.tonePrimary, secondary: t.toneSecondary, dark: t.toneDark, gradient: t.toneGradient }[tone],
              }))}
              onChange={(v) => settings(sPath, { tone: v })}
            />
          </Field>
          <Field label={t.width}>
            <Segmented label={t.width} value={str(s.width) || "default"} options={SECTION_WIDTHS.map((w) => ({ value: w, label: { narrow: t.widthNarrow, default: t.widthDefault, wide: t.widthWide, full: t.widthFull }[w] }))} onChange={(v) => settings(sPath, { width: v })} />
          </Field>
          <Field label={t.padding}>
            <Segmented label={t.padding} value={str(s.padding) || "md"} options={SECTION_PADDINGS.map((p) => ({ value: p, label: { none: t.padNone, sm: t.padSm, md: t.padMd, lg: t.padLg }[p] }))} onChange={(v) => settings(sPath, { padding: v })} />
          </Field>
          <Field label={t.align}>
            <Segmented
              label={t.align}
              value={str(s.align) === "center" ? "center" : "start"}
              options={[
                { value: "start", label: t.alignStart },
                { value: "center", label: t.alignCenter },
              ]}
              onChange={(v) => settings(sPath, { align: v === "center" ? "center" : "" })}
            />
          </Field>
          <ImageField label={t.backgroundImage} value={str(s.backgroundImage)} onChange={(url) => settings(sPath, { backgroundImage: url })} />
          <Switch label={t.decor} checked={s.decor === true} onChange={(v) => settings(sPath, { decor: v || "" })} />
          <Field label={t.anchor} hint={t.anchorHint} warning={str(s.anchor) && /[^a-z0-9-_]/i.test(str(s.anchor)) ? t.anchorHint : null}>
            <TextInput dir="ltr" value={str(s.anchor)} placeholder="products" onChange={(v) => settings(sPath, { anchor: v.slice(0, 40) }, `${sPath}:anchor`)} />
          </Field>
        </Block>
        <Block>
          <Switch label={t.hideSection} checked={s.hidden === true} onChange={() => dispatch({ type: "toggleHidden", sectionId: sPath })} />
          <Switch label={t.hideOnMobile} checked={s.hideOnMobile === true} onChange={(v) => settings(sPath, { hideOnMobile: v || "" })} />
          <Switch label={t.hideOnDesktop} checked={s.hideOnDesktop === true} onChange={(v) => settings(sPath, { hideOnDesktop: v || "" })} />
        </Block>
        <Block title={t.rowsInSection}>
          <NodeList items={section.rows.map((row, i) => ({ path: `${sPath}/${row.id}`, label: `${t.kindRow} ${i + 1} · ${row.columns.length} ${t.columns}` }))} onSelect={select} />
        </Block>
      </>
    );
  } else if (r.kind === "row" && r.row) {
    const row = r.row;
    const rPath = `${sPath}/${row.id}`;
    const s = row.settings ?? {};
    const spans = row.columns.map((c) => c.span ?? 12);
    body = (
      <>
        <Block>
          <Field label={t.columns}>
            <div className="grid grid-cols-3 gap-1.5">
              {COLUMN_PRESETS.map((preset) => {
                const active = preset.join() === spans.join();
                return (
                  <button
                    key={preset.join()}
                    type="button"
                    aria-pressed={active}
                    aria-label={preset.join(" / ")}
                    onClick={() => dispatch({ type: "setRowColumns", rowPath: rPath, spans: preset })}
                    className={cn("flex h-8 cursor-pointer gap-0.5 rounded-md border p-1", active ? "border-primary bg-primary-soft" : "border-line hover:border-primary")}
                  >
                    {preset.map((span, i) => (
                      <span key={i} className={cn("rounded-sm", active ? "bg-primary/60" : "bg-ink/20")} style={{ flex: span }} />
                    ))}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label={t.rowLayout}>
            <Segmented label={t.rowLayout} value={str(s.layout) || "grid"} options={ROW_LAYOUTS.map((l) => ({ value: l, label: { grid: t.layoutGrid, cards: t.layoutCards, steps: t.layoutSteps, logos: t.layoutLogos }[l] }))} onChange={(v) => settings(rPath, { layout: v })} />
          </Field>
          <Field label={t.mobileColumns}>
            <Segmented label={t.mobileColumns} value={String(s.mobileColumns ?? 1)} options={["1", "2"].map((v) => ({ value: v, label: v }))} onChange={(v) => settings(rPath, { mobileColumns: Number(v) })} />
          </Field>
          <Switch label={t.verticalCenter} checked={s.valign === "center"} onChange={(v) => settings(rPath, { valign: v ? "center" : "" })} />
          <Switch label={t.reverse} checked={s.reverse === true} onChange={(v) => settings(rPath, { reverse: v || "" })} />
        </Block>
        <Block title={t.columnsInRow}>
          <NodeList items={row.columns.map((c, i) => ({ path: `${rPath}/${c.id}`, label: `${t.kindColumn} ${i + 1} · ${c.span ?? 12}/12 · ${c.elements.length} ${t.elementsInColumn}` }))} onSelect={select} />
        </Block>
      </>
    );
  } else if (r.kind === "column" && r.row && r.column) {
    const cPath = `${sPath}/${r.row.id}/${r.column.id}`;
    const s = r.column.settings ?? {};
    body = (
      <>
        <Block>
          <Field label={t.columnSpan}>
            <NumberInput value={r.column.span ?? 12} min={1} max={12} onChange={(v) => settings(cPath, { span: v })} />
          </Field>
          <Switch label={t.columnCard} checked={s.card === true} onChange={(v) => settings(cPath, { card: v || "" })} />
          <Switch label={t.columnHighlight} checked={s.highlight === true} onChange={(v) => settings(cPath, { highlight: v || "" })} />
          <Field label={t.align}>
            <Segmented
              label={t.align}
              value={str(s.align) === "center" ? "center" : "start"}
              options={[
                { value: "start", label: t.alignStart },
                { value: "center", label: t.alignCenter },
              ]}
              onChange={(v) => settings(cPath, { align: v === "center" ? "center" : "" })}
            />
          </Field>
          <Switch label={t.verticalCenter} checked={s.valign === "center"} onChange={(v) => settings(cPath, { valign: v ? "center" : "" })} />
        </Block>
        <Block title={t.elementsInColumn}>
          <NodeList items={r.column.elements.map((e) => ({ path: `${cPath}/${e.id}`, label: ELEMENT_LABELS[e.type][uiLocale] }))} onSelect={select} />
        </Block>
      </>
    );
  } else if (r.kind === "element" && r.element) {
    const el = r.element;
    const props = el.props ?? {};
    const fields = el.type === "rich_text" && props.format === "table" ? TABLE_FIELDS : ELEMENT_FIELDS[el.type];
    body = (
      <>
        <Block>
          {fields.map((def) => (
            <ElementFieldControl
              key={def.key}
              def={def}
              value={props[def.key]}
              pages={pages}
              catalog={catalog}
              locale={uiLocale}
              onChange={(value) => {
                dispatch({ type: "updateProps", path: selection, patch: { [def.key]: value }, group: `${selection}:${def.key}`, at: Date.now() });
                onContentEdited();
              }}
            />
          ))}
        </Block>
        <Block>
          <div className="flex gap-2">
            <button type="button" onClick={() => dispatch({ type: "moveElement", path: selection, delta: -1 })} className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md border border-line py-1.5 text-xs hover:border-primary">
              <ArrowUp className="size-3.5" aria-hidden />
              {t.moveUp}
            </button>
            <button type="button" onClick={() => dispatch({ type: "moveElement", path: selection, delta: 1 })} className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md border border-line py-1.5 text-xs hover:border-primary">
              <ArrowDown className="size-3.5" aria-hidden />
              {t.moveDown}
            </button>
          </div>
        </Block>
      </>
    );
  }

  const canDelete = r.kind === "section" || r.kind === "element" || (r.kind === "column" && (r.row?.columns.length ?? 0) > 1) || (r.kind === "row" && section.rows.length > 1);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-3 py-2.5">
        <nav aria-label="breadcrumb" className="mb-1 flex flex-wrap items-center gap-0.5 text-[11px] text-ink-muted">
          {crumbs.slice(0, -1).map((c) => (
            <span key={c.path} className="inline-flex items-center gap-0.5">
              <button type="button" onClick={() => select(c.path)} className="max-w-[9rem] cursor-pointer truncate hover:text-primary hover:underline" dir="auto">
                {c.label}
              </button>
              <ChevronLeft className="size-3 ltr:rotate-180" aria-hidden />
            </span>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-2">
          <h2 dir="auto" className="truncate text-sm font-bold text-ink">
            {title}
          </h2>
          {canDelete && (
            <button type="button" onClick={() => onDelete(selection)} aria-label={t.delete} title={t.delete} className="flex size-7 cursor-pointer items-center justify-center rounded-md text-ink-muted hover:bg-danger-soft hover:text-danger">
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
    </div>
  );
}
