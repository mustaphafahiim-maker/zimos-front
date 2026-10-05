import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button, Input, Label } from "@store-builder/ui";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { ImageField } from "./ImageField";
import { useEditorLocale } from "./editorLocale";

/**
 * The inspector's editor for a list of objects — a slider's slides, a row of
 * category tiles, a need picker's needs, a shelf of videos. Each entry is a
 * small card of the fields its spec names; entries can be added, removed and
 * moved up or down. A long list stays readable because every card after the
 * first folds shut under its own title.
 *
 * Sub-fields carry both wordings (`label` / `labelAr`) so this file needs no
 * entry in editorLocale's tables.
 */

export type ItemSubField =
  | { key: string; label: string; labelAr: string; kind: "text" | "textarea" | "image" | "lines"; ltr?: boolean }
  | {
      key: string;
      label: string;
      labelAr: string;
      kind: "select";
      options: Array<{ value: string; label: string; labelAr: string }>;
    };

type Item = Record<string, unknown>;

function asItems(raw: unknown): Item[] {
  return Array.isArray(raw)
    ? raw.filter((entry): entry is Item => !!entry && typeof entry === "object" && !Array.isArray(entry))
    : [];
}

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const lines = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").join("\n") : "");

export function ItemListField({
  label,
  hint,
  value,
  itemLabel,
  itemLabelAr,
  titleKey,
  fields,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: unknown;
  itemLabel: string;
  itemLabelAr: string;
  /** The sub-field whose text names an entry in its folded header. */
  titleKey: string;
  fields: ItemSubField[];
  max: number;
  onChange: (next: Item[]) => void;
}) {
  const ar = useEditorLocale() === "ar";
  const items = asItems(value);
  const noun = ar ? itemLabelAr : itemLabel;

  const patch = (i: number, key: string, v: unknown) => onChange(items.map((item, j) => (j === i ? { ...item, [key]: v } : item)));
  const move = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <details key={i} open={i === 0 && items.length === 1} className="rounded-[0.5rem] border border-line">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm font-medium text-ink">
              <span className="min-w-0 flex-1 truncate" dir="auto">
                {str(item[titleKey]).trim() || `${noun} ${i + 1}`}
              </span>
              <Button type="button" size="icon" variant="ghost" aria-label={ar ? `تحريك ${noun} ${i + 1} لأعلى` : `Move ${noun} ${i + 1} up`} disabled={i === 0} onClick={(e) => { e.preventDefault(); move(i, -1); }}>
                <ChevronUp className="size-4" aria-hidden />
              </Button>
              <Button type="button" size="icon" variant="ghost" aria-label={ar ? `تحريك ${noun} ${i + 1} لأسفل` : `Move ${noun} ${i + 1} down`} disabled={i === items.length - 1} onClick={(e) => { e.preventDefault(); move(i, 1); }}>
                <ChevronDown className="size-4" aria-hidden />
              </Button>
              <Button type="button" size="icon" variant="ghost" aria-label={ar ? `حذف ${noun} ${i + 1}` : `Remove ${noun} ${i + 1}`} onClick={(e) => { e.preventDefault(); onChange(items.filter((_, j) => j !== i)); }}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </summary>
            <div className="space-y-3 border-t border-line p-3">
              {fields.map((field) => {
                const fieldLabel = ar ? field.labelAr : field.label;
                const id = `item-${i}-${field.key}`;
                if (field.kind === "image") {
                  return <ImageField key={field.key} label={fieldLabel} value={str(item[field.key])} onChange={(url) => patch(i, field.key, url)} />;
                }
                if (field.kind === "select") {
                  return (
                    <div key={field.key} className="space-y-1.5">
                      <Label htmlFor={id}>{fieldLabel}</Label>
                      <Select id={id} value={str(item[field.key])} onChange={(e) => patch(i, field.key, e.target.value)}>
                        <option value="">—</option>
                        {field.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {ar ? option.labelAr : option.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  );
                }
                if (field.kind === "textarea" || field.kind === "lines") {
                  return (
                    <div key={field.key} className="space-y-1.5">
                      <Label htmlFor={id}>{fieldLabel}</Label>
                      <Textarea
                        id={id}
                        rows={3}
                        dir="auto"
                        value={field.kind === "lines" ? lines(item[field.key]) : str(item[field.key])}
                        onChange={(e) =>
                          patch(
                            i,
                            field.key,
                            // One line per entry; blank lines are kept while typing and dropped by the storefront.
                            field.kind === "lines" ? e.target.value.split("\n") : e.target.value
                          )
                        }
                      />
                    </div>
                  );
                }
                return (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={id}>{fieldLabel}</Label>
                    <Input id={id} dir={field.ltr ? "ltr" : "auto"} value={str(item[field.key])} onChange={(e) => patch(i, field.key, e.target.value)} />
                  </div>
                );
              })}
            </div>
          </details>
        ))}
      </div>
      <Button type="button" size="sm" variant="outline" disabled={items.length >= max} onClick={() => onChange([...items, {}])}>
        <Plus className="size-4" aria-hidden />
        {ar ? `إضافة ${noun}` : `Add ${noun.toLowerCase()}`}
      </Button>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}
