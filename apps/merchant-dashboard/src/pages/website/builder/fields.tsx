import { useId, useRef, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { safeHref, type RendererLocale } from "@store-builder/store-renderer";
import { cn } from "@store-builder/ui";
import { ImageField, ImageListField } from "../editor/ImageField";
import type { FieldDef } from "./elementLibrary";
import type { CatalogData } from "./StoreChrome";
import { useBuilderT } from "./strings";

/** Small, dense inspector controls (no dashboard page chrome). */

const inputCls =
  "w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

export function Field({ label, hint, warning, children, htmlFor }: { label: string; hint?: string; warning?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-ink-soft">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-ink-muted">{hint}</p>}
      {warning && <p className="text-[11px] font-medium leading-snug text-warning">{warning}</p>}
    </div>
  );
}

export function TextInput({ id, value, onChange, placeholder, dir }: { id?: string; value: string; onChange: (v: string) => void; placeholder?: string; dir?: "ltr" | "rtl" | "auto" }) {
  return <input id={id} className={inputCls} value={value} placeholder={placeholder} dir={dir ?? "auto"} onChange={(e) => onChange(e.target.value)} />;
}

export function TextArea({ id, value, onChange, rows = 3, inputRef }: { id?: string; value: string; onChange: (v: string) => void; rows?: number; inputRef?: React.Ref<HTMLTextAreaElement> }) {
  return <textarea ref={inputRef} id={id} className={cn(inputCls, "resize-y leading-relaxed")} rows={rows} dir="auto" value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function NumberInput({ id, value, min, max, onChange }: { id?: string; value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <input
      id={id}
      type="number"
      className={cn(inputCls, "tabular")}
      value={Number.isFinite(value) ? value : ""}
      min={min}
      max={max}
      dir="ltr"
      onChange={(e) => {
        const n = Number(e.target.value);
        if (e.target.value === "" || !Number.isFinite(n)) return;
        onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, Math.round(n))));
      }}
    />
  );
}

export function SelectInput({ id, value, options, onChange }: { id?: string; value: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void }) {
  return (
    <select id={id} className={cn(inputCls, "cursor-pointer")} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg py-1 text-start text-sm text-ink"
    >
      <span>{label}</span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-line")}>
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", checked ? "start-[1.125rem]" : "start-0.5")} />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg border border-line bg-paper p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-w-0 flex-1 cursor-pointer truncate rounded-md px-1.5 py-1 text-xs font-medium transition-colors",
            value === o.value ? "bg-primary text-white shadow-sm" : "text-ink-soft hover:bg-primary-soft hover:text-primary"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ColorInput({ label, value, onChange, warning }: { label: string; value: string; onChange: (v: string) => void; warning?: string | null }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} warning={warning}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-line bg-paper p-0.5"
        />
        <input id={id} className={cn(inputCls, "font-mono uppercase")} dir="ltr" value={value} maxLength={7} onChange={(e) => onChange(e.target.value)} />
      </div>
    </Field>
  );
}

export function LinkInput({
  id,
  value,
  onChange,
  pages,
  catalog,
  locale,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  pages: Array<{ title: string; path: string }>;
  catalog: CatalogData;
  locale: RendererLocale;
}) {
  const t = useBuilderT();
  void locale;
  return (
    <div className="space-y-1.5">
      <input id={id} className={cn(inputCls, "font-mono text-xs")} dir="ltr" value={value} placeholder="/about, https://…" onChange={(e) => onChange(e.target.value)} />
      <select
        aria-label={t.chooseLink}
        className={cn(inputCls, "cursor-pointer text-xs")}
        value=""
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
      >
        <option value="">{t.chooseLink}</option>
        <optgroup label={t.linkPages}>
          {pages.map((p) => (
            <option key={p.path} value={p.path}>
              {p.title} ({p.path})
            </option>
          ))}
          <option value="/?search=1#products">{t.linkAllProducts}</option>
          <option value="/track">{t.linkTrack}</option>
        </optgroup>
        {catalog.products.length > 0 && (
          <optgroup label={t.linkProducts}>
            {catalog.products.slice(0, 50).map((p) => (
              <option key={p.id} value={`/products/${p.slug}`}>
                {p.name}
              </option>
            ))}
          </optgroup>
        )}
        {catalog.collections.length > 0 && (
          <optgroup label={t.linkCollections}>
            {catalog.collections.slice(0, 50).map((c) => (
              <option key={c.id} value={`/collections/${c.slug || c.id}`}>
                {c.name}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="…">
          <option value="https://wa.me/20">{t.linkWhatsapp}</option>
          <option value="https://">{t.linkExternal}</option>
        </optgroup>
      </select>
    </div>
  );
}

function RowButtons({ onRemove, label }: { onRemove: () => void; label: string }) {
  return (
    <button type="button" onClick={onRemove} aria-label={label} title={label} className="shrink-0 cursor-pointer rounded-md p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger">
      <Trash2 className="size-3.5" aria-hidden />
    </button>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary-soft">
      <Plus className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}

export function StringListEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const t = useBuilderT();
  return (
    <div className="space-y-1.5">
      {value.map((item, i) => (
        <div key={i} className="flex items-center gap-1">
          <TextInput value={item} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} />
          <RowButtons label={t.removeItem} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
        </div>
      ))}
      <AddButton label={t.addItem} onClick={() => onChange([...value, ""])} />
    </div>
  );
}

export function QaListEditor({ value, onChange }: { value: Array<{ q: string; a: string }>; onChange: (v: Array<{ q: string; a: string }>) => void }) {
  const t = useBuilderT();
  return (
    <div className="space-y-2">
      {value.map((item, i) => (
        <div key={i} className="space-y-1 rounded-lg border border-line bg-paper p-2">
          <div className="flex items-center gap-1">
            <TextInput value={item.q} placeholder={t.question} onChange={(q) => onChange(value.map((x, j) => (j === i ? { ...x, q } : x)))} />
            <RowButtons label={t.removeItem} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
          </div>
          <TextArea rows={2} value={item.a} onChange={(a) => onChange(value.map((x, j) => (j === i ? { ...x, a } : x)))} />
        </div>
      ))}
      <AddButton label={t.addItem} onClick={() => onChange([...value, { q: "", a: "" }])} />
    </div>
  );
}

export function LinkListEditor({ value, onChange }: { value: Array<{ platform: string; url: string }>; onChange: (v: Array<{ platform: string; url: string }>) => void }) {
  const t = useBuilderT();
  return (
    <div className="space-y-2">
      {value.map((item, i) => (
        <div key={i} className="flex items-start gap-1">
          <div className="grid min-w-0 flex-1 gap-1">
            <TextInput value={item.platform} placeholder={t.platform} onChange={(platform) => onChange(value.map((x, j) => (j === i ? { ...x, platform } : x)))} />
            <TextInput dir="ltr" value={item.url} placeholder="https://" onChange={(url) => onChange(value.map((x, j) => (j === i ? { ...x, url } : x)))} />
            {item.url && !safeHref(item.url) && <p className="text-[11px] text-warning">{t.linkInvalid}</p>}
          </div>
          <RowButtons label={t.removeItem} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
        </div>
      ))}
      <AddButton label={t.addLink} onClick={() => onChange([...value, { platform: "", url: "" }])} />
    </div>
  );
}

export function parseTable(text: string): string[][] {
  const rows = text.split("\n").map((line) => line.split("|").map((c) => c.trim()));
  const width = Math.max(1, ...rows.map((r) => r.length));
  return rows.filter((r) => r.some((c) => c !== "")).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));
}

export function serializeTable(rows: string[][]): string {
  return rows.map((r) => r.join(" | ")).join("\n");
}

export function TableEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useBuilderT();
  const rows = parseTable(value);
  const grid = rows.length > 0 ? rows : [[""]];
  const set = (next: string[][]) => onChange(serializeTable(next));
  return (
    <div className="space-y-1.5">
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5">
          <tbody>
            {grid.map((r, ri) => (
              <tr key={ri}>
                {r.map((cell, ci) => (
                  <td key={ci}>
                    <input
                      aria-label={`${ri + 1}:${ci + 1}`}
                      className={cn(inputCls, "w-20 px-1.5 py-1 text-xs", ri === 0 && "font-semibold")}
                      value={cell}
                      onChange={(e) => set(grid.map((row, i) => (i === ri ? row.map((c, j) => (j === ci ? e.target.value.replace(/[|\n]/g, " ") : c)) : row)))}
                    />
                  </td>
                ))}
                <td>
                  <RowButtons label={t.removeItem} onRemove={() => set(grid.filter((_, i) => i !== ri))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-ink-muted">{t.tableHint}</p>
      <div className="flex gap-1">
        <AddButton label={t.addRow} onClick={() => set([...grid, grid[0].map(() => "")])} />
        <AddButton label={t.addColumn} onClick={() => set(grid.map((r) => [...r, ""]))} />
      </div>
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DateTimeInput({ id, value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  const t = useBuilderT();
  const past = !!value && Date.parse(value) <= Date.now();
  return (
    <div className="space-y-1">
      <input
        id={id}
        type="datetime-local"
        dir="ltr"
        className={inputCls}
        value={toLocalInput(value)}
        onChange={(e) => {
          const d = new Date(e.target.value);
          onChange(e.target.value && !Number.isNaN(d.getTime()) ? d.toISOString() : "");
        }}
      />
      {past && <p className="text-[11px] text-warning">{t.endsAtPast}</p>}
    </div>
  );
}

/**
 * The renderer prints rich_text as plain text (newlines kept), so the toolbar
 * only offers structure that survives: bullets and paragraph breaks.
 */
export function RichTextEditor({ id, value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  const t = useBuilderT();
  const ref = useRef<HTMLTextAreaElement>(null);
  function insert(fn: (before: string, after: string) => string) {
    const el = ref.current;
    const pos = el ? el.selectionStart : value.length;
    onChange(fn(value.slice(0, pos), value.slice(pos)));
    requestAnimationFrame(() => el?.focus());
  }
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        <button
          type="button"
          className="cursor-pointer rounded-md border border-line px-2 py-0.5 text-xs text-ink-soft hover:border-primary hover:text-primary"
          onClick={() => insert((b, a) => `${b}${b === "" || b.endsWith("\n") ? "" : "\n"}• ${a}`)}
        >
          {t.richBullet}
        </button>
        <button type="button" className="cursor-pointer rounded-md border border-line px-2 py-0.5 text-xs text-ink-soft hover:border-primary hover:text-primary" onClick={() => insert((b, a) => `${b}\n\n${a}`)}>
          {t.richParagraph}
        </button>
      </div>
      <TextArea id={id} inputRef={ref} rows={6} value={value} onChange={onChange} />
      <p className="text-[11px] text-ink-muted">{t.richFormatNote}</p>
    </div>
  );
}

const asStr = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

/** One inspector control generated from an element FieldDef. */
export function ElementFieldControl({
  def,
  value,
  onChange,
  pages,
  catalog,
  locale,
}: {
  def: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  pages: Array<{ title: string; path: string }>;
  catalog: CatalogData;
  locale: RendererLocale;
}) {
  const t = useBuilderT();
  const id = useId();
  const label = def.label[locale];
  const hint = def.hint?.[locale];
  const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
  let warning: string | null = def.required && empty ? t.required : null;

  let control: ReactNode;
  switch (def.kind) {
    case "text":
      control = <TextInput id={id} value={asStr(value)} onChange={onChange} />;
      break;
    case "textarea":
      control = <TextArea id={id} value={asStr(value)} onChange={onChange} />;
      break;
    case "rich":
      control = <RichTextEditor id={id} value={asStr(value)} onChange={onChange} />;
      break;
    case "number":
      control = <NumberInput id={id} value={typeof value === "number" ? value : Number(value ?? def.defaultValue ?? 0)} min={def.min} max={def.max} onChange={onChange} />;
      break;
    case "select": {
      const current = value === undefined || value === null ? asStr(def.defaultValue ?? def.options?.[0]?.value ?? "") : asStr(value);
      control = (
        <SelectInput
          id={id}
          value={current}
          options={(def.options ?? []).map((o) => ({ value: o.value, label: o.label[locale] }))}
          onChange={(v) => onChange(def.key === "level" ? Number(v) : v)}
        />
      );
      break;
    }
    case "toggle":
      return <Switch label={label} checked={typeof value === "boolean" ? value : def.defaultValue === true} onChange={onChange} />;
    case "image":
      return <ImageField label={label} value={asStr(value)} hint={warning ?? hint} onChange={onChange} />;
    case "images":
      return <ImageListField label={label} value={Array.isArray(value) ? (value as unknown[]).filter((x): x is string => typeof x === "string") : []} hint={hint} onChange={onChange} />;
    case "link": {
      const v = asStr(value);
      if (v && !safeHref(v)) warning = t.linkInvalid;
      control = <LinkInput id={id} value={v} onChange={onChange} pages={pages} catalog={catalog} locale={locale} />;
      break;
    }
    case "strList":
      control = <StringListEditor value={Array.isArray(value) ? (value as unknown[]).map(asStr) : []} onChange={onChange} />;
      break;
    case "qaList":
      control = (
        <QaListEditor
          value={Array.isArray(value) ? (value as Array<Record<string, unknown>>).map((x) => ({ q: asStr(x?.q), a: asStr(x?.a) })) : []}
          onChange={onChange}
        />
      );
      break;
    case "links":
      control = (
        <LinkListEditor
          value={Array.isArray(value) ? (value as Array<Record<string, unknown>>).map((x) => ({ platform: asStr(x?.platform), url: asStr(x?.url) })) : []}
          onChange={onChange}
        />
      );
      break;
    case "product":
      control = (
        <SelectInput
          id={id}
          value={asStr(value)}
          options={[{ value: "", label: t.noProduct }, ...catalog.products.map((p) => ({ value: p.id, label: p.name }))]}
          onChange={onChange}
        />
      );
      break;
    case "collection":
      control = (
        <SelectInput id={id} value={asStr(value)} options={[{ value: "", label: t.allCollections }, ...catalog.collections.map((c) => ({ value: c.id, label: c.name }))]} onChange={onChange} />
      );
      break;
    case "datetime":
      control = <DateTimeInput id={id} value={asStr(value)} onChange={onChange} />;
      break;
    case "table":
      control = <TableEditor value={asStr(value)} onChange={onChange} />;
      break;
  }
  return (
    <Field label={label} hint={hint} warning={warning} htmlFor={id}>
      {control}
    </Field>
  );
}
