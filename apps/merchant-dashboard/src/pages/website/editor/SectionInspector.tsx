import type { ReactNode } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button, Input, Label } from "@store-builder/ui";
import type { PageElement, PageElementType, PageSection } from "@store-builder/api-client";
import { Field, TextField } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { Select } from "@/components/Select";
import {
  ELEMENT_SPECS,
  elementPosition,
  moveElement,
  sectionElements,
  sectionLabel,
  setElementProp,
  type FieldSpec,
} from "./blocks";
import { MoveButtons } from "./MoveButtons";
import {
  editorUi,
  elementLabel,
  fieldHint,
  fieldLabel,
  optionLabel,
  useEditorLocale,
  type EditorUi,
} from "./editorLocale";
import { ImageField, ImageListField } from "./ImageField";

/**
 * The right-hand panel. A section has no editable fields of its own — the tree
 * gives sections no props — so this walks the section's elements and renders a
 * fieldset per element from that element type's `FieldSpec[]`.
 *
 * Content inputs are `dir="auto"`: merchants write Arabic and English copy,
 * and each field should follow the text typed into it, whatever direction the
 * editor chrome is in. URL-like fields stay left-to-right.
 */

/** Prop keys that hold URLs or ids, which always read left-to-right. */
const LTR_KEYS = new Set(["href", "url", "src", "productId", "name"]);

// --- prop readers: props are `unknown`, so coerce defensively --------------

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function asNumber(v: unknown): number | "" {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return "";
}

function asStringList(v: unknown): string[] {
  return Array.isArray(v) ? v.map(asString) : [];
}

interface QaItem {
  q: string;
  a: string;
}

function asQaList(v: unknown): QaItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    return { q: asString(o.q), a: asString(o.a) };
  });
}

interface StoryStepItem {
  title: string;
  body: string;
  image: string;
}

function asStepList(v: unknown): StoryStepItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    return { title: asString(o.title), body: asString(o.body), image: asString(o.image) };
  });
}

interface LinkItem {
  platform: string;
  url: string;
}

function asLinkList(v: unknown): LinkItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    return { platform: asString(o.platform), url: asString(o.url) };
  });
}

// --- repeatable list editors ----------------------------------------------

function ListShell({
  label,
  hint,
  onAdd,
  addLabel,
  children,
}: {
  label: string;
  hint?: string;
  onAdd: () => void;
  addLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      <Button type="button" size="sm" variant="outline" onClick={onAdd}>
        <Plus className="size-4" aria-hidden />
        {addLabel}
      </Button>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

function StringListEditor({
  label,
  hint,
  itemLabel,
  value,
  ui,
  onChange,
}: {
  label: string;
  hint?: string;
  itemLabel: string;
  value: string[];
  ui: EditorUi;
  onChange: (next: string[]) => void;
}) {
  return (
    <ListShell label={label} hint={hint} addLabel={ui.addItem(itemLabel)} onAdd={() => onChange([...value, ""])}>
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={item}
              dir="auto"
              aria-label={ui.itemAria(itemLabel, i + 1)}
              onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={ui.removeItem(itemLabel, i + 1)}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
      </div>
    </ListShell>
  );
}

function QaListEditor({
  label,
  hint,
  value,
  ui,
  onChange,
}: {
  label: string;
  hint?: string;
  value: QaItem[];
  ui: EditorUi;
  onChange: (next: QaItem[]) => void;
}) {
  function patch(i: number, key: keyof QaItem, v: string) {
    onChange(value.map((item, j) => (j === i ? { ...item, [key]: v } : item)));
  }
  return (
    <ListShell label={label} hint={hint} addLabel={ui.addQuestion} onAdd={() => onChange([...value, { q: "", a: "" }])}>
      <div className="space-y-3">
        {value.map((item, i) => (
          <div key={i} className="space-y-2 rounded-[0.5rem] border border-line p-3">
            <div className="flex items-center gap-2">
              <Input
                value={item.q}
                dir="auto"
                placeholder={ui.question}
                aria-label={ui.questionAria(i + 1)}
                onChange={(e) => patch(i, "q", e.target.value)}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={ui.removeQuestion(i + 1)}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
            <Textarea
              value={item.a}
              dir="auto"
              placeholder={ui.answer}
              aria-label={ui.answerAria(i + 1)}
              rows={2}
              onChange={(e) => patch(i, "a", e.target.value)}
            />
          </div>
        ))}
      </div>
    </ListShell>
  );
}

/**
 * `scroll_story` steps — a title, a line of text and a picture per step. The
 * picture reuses the same uploader as every other image field, so a step image
 * lands in the store's media library like all the rest.
 */
function StepListEditor({
  label,
  hint,
  value,
  ui,
  onChange,
}: {
  label: string;
  hint?: string;
  value: StoryStepItem[];
  ui: EditorUi;
  onChange: (next: StoryStepItem[]) => void;
}) {
  function patch(i: number, key: keyof StoryStepItem, v: string) {
    onChange(value.map((item, j) => (j === i ? { ...item, [key]: v } : item)));
  }
  return (
    <ListShell
      label={label}
      hint={hint}
      addLabel={ui.addStep}
      onAdd={() => onChange([...value, { title: "", body: "", image: "" }])}
    >
      <div className="space-y-3">
        {value.map((item, i) => (
          <div key={i} className="space-y-2 rounded-[0.5rem] border border-line p-3">
            <div className="flex items-center gap-2">
              <Input
                value={item.title}
                dir="auto"
                placeholder={ui.stepTitle}
                aria-label={ui.stepTitleAria(i + 1)}
                onChange={(e) => patch(i, "title", e.target.value)}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={ui.removeStep(i + 1)}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
            <Textarea
              value={item.body}
              dir="auto"
              placeholder={ui.stepBody}
              aria-label={ui.stepBodyAria(i + 1)}
              rows={2}
              onChange={(e) => patch(i, "body", e.target.value)}
            />
            <ImageField label={ui.stepImageAria(i + 1)} value={item.image} onChange={(url) => patch(i, "image", url)} />
          </div>
        ))}
      </div>
    </ListShell>
  );
}

function LinkListEditor({
  label,
  hint,
  value,
  ui,
  onChange,
}: {
  label: string;
  hint?: string;
  value: LinkItem[];
  ui: EditorUi;
  onChange: (next: LinkItem[]) => void;
}) {
  function patch(i: number, key: keyof LinkItem, v: string) {
    onChange(value.map((item, j) => (j === i ? { ...item, [key]: v } : item)));
  }
  return (
    <ListShell
      label={label}
      hint={hint}
      addLabel={ui.addLink}
      onAdd={() => onChange([...value, { platform: "", url: "" }])}
    >
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={item.platform}
              dir="ltr"
              placeholder="instagram"
              aria-label={ui.platformAria(i + 1)}
              className="w-1/3"
              onChange={(e) => patch(i, "platform", e.target.value)}
            />
            <Input
              value={item.url}
              dir="ltr"
              placeholder="https://…"
              aria-label={ui.linkAria(i + 1)}
              onChange={(e) => patch(i, "url", e.target.value)}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={ui.removeLink(i + 1)}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
      </div>
    </ListShell>
  );
}

// --- one field ------------------------------------------------------------

function ElementField({
  elementType,
  spec,
  props,
  onChange,
}: {
  elementType: PageElementType;
  spec: FieldSpec;
  props: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const locale = useEditorLocale();
  const ui = editorUi(locale);
  const raw = props[spec.key];
  const label = fieldLabel(elementType, spec.key, spec.label, locale);
  const hint = fieldHint(elementType, spec.key, spec.hint, locale);
  const dir = LTR_KEYS.has(spec.key) ? "ltr" : "auto";

  switch (spec.kind) {
    case "text":
      return (
        <TextField
          label={label}
          hint={hint}
          placeholder={spec.placeholder}
          dir={dir}
          value={asString(raw)}
          onChange={(e) => onChange(spec.key, e.target.value)}
        />
      );

    case "textarea":
      return (
        <Field label={label} hint={hint}>
          {({ id }) => (
            <Textarea
              id={id}
              rows={3}
              dir={dir}
              placeholder={spec.placeholder}
              value={asString(raw)}
              onChange={(e) => onChange(spec.key, e.target.value)}
            />
          )}
        </Field>
      );

    case "number":
      return (
        <Field label={label} hint={hint}>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min={spec.min}
              max={spec.max}
              value={asNumber(raw)}
              onChange={(e) => {
                const v = e.target.value;
                // Keep the prop numeric — the storefront renderer expects a
                // number — but let the field go empty while typing.
                onChange(spec.key, v === "" ? "" : Number(v));
              }}
            />
          )}
        </Field>
      );

    case "boolean":
      return (
        <label className="flex items-center gap-2 py-1 text-sm text-ink">
          <input
            type="checkbox"
            checked={raw === true}
            onChange={(e) => onChange(spec.key, e.target.checked)}
            className="size-4 rounded border-line text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          {label}
        </label>
      );

    case "select":
      return (
        <Field label={label} hint={hint}>
          {({ id }) => (
            <Select
              id={id}
              value={asString(raw)}
              onChange={(e) => {
                const v = e.target.value;
                // "level" on a heading is an int in the seeded trees; keep it one.
                const numeric = spec.options.every((o) => /^\d+$/.test(o.value));
                onChange(spec.key, numeric ? Number(v) : v);
              }}
            >
              <option value="">—</option>
              {spec.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {optionLabel(spec.key, o.value, o.label, locale)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      );

    case "image":
      return (
        <ImageField
          label={label}
          hint={hint}
          value={asString(raw)}
          onChange={(url) => onChange(spec.key, url)}
        />
      );

    case "imageList":
      return (
        <ImageListField
          label={label}
          hint={hint}
          value={asStringList(raw)}
          onChange={(urls) => onChange(spec.key, urls)}
        />
      );

    case "stringList":
      return (
        <StringListEditor
          label={label}
          hint={hint}
          itemLabel={locale === "ar" ? ui.listItem : spec.itemLabel}
          value={asStringList(raw)}
          ui={ui}
          onChange={(next) => onChange(spec.key, next)}
        />
      );

    case "qaList":
      return (
        <QaListEditor
          label={label}
          hint={hint}
          value={asQaList(raw)}
          ui={ui}
          onChange={(next) => onChange(spec.key, next)}
        />
      );

    case "stepList":
      return (
        <StepListEditor
          label={label}
          hint={hint}
          value={asStepList(raw)}
          ui={ui}
          onChange={(next) => onChange(spec.key, next)}
        />
      );

    case "linkList":
      return (
        <LinkListEditor
          label={label}
          hint={hint}
          value={asLinkList(raw)}
          ui={ui}
          onChange={(next) => onChange(spec.key, next)}
        />
      );
  }
}

/**
 * Reorder controls for one element within its column. Renders nothing when the
 * element has no neighbour to swap with.
 */
export function ElementMoveButtons({
  section,
  elementId,
  label,
  ui,
  onChange,
}: {
  section: PageSection;
  elementId: string;
  label: string;
  ui: EditorUi;
  onChange: (next: PageSection) => void;
}) {
  const position = elementPosition(section, elementId);
  if (!position || position.count < 2) return null;
  return (
    <MoveButtons
      canMoveUp={position.index > 0}
      canMoveDown={position.index < position.count - 1}
      onMoveUp={() => onChange(moveElement(section, elementId, -1))}
      onMoveDown={() => onChange(moveElement(section, elementId, 1))}
      upLabel={ui.moveElementUp(label)}
      downLabel={ui.moveElementDown(label)}
    />
  );
}

/**
 * The fields of one element. Shared with the funnel builder's form view, which
 * lays several of these out inline instead of in a side panel; `actions` puts
 * extra controls (e.g. reordering) on the element's caption row.
 */
export function ElementFieldset({
  element,
  onPropChange,
  actions,
}: {
  element: PageElement;
  onPropChange: (element: PageElement, key: string, value: unknown) => void;
  actions?: ReactNode;
}) {
  const locale = useEditorLocale();
  const spec = ELEMENT_SPECS[element.type];
  const Icon = spec.icon;
  const props = element.props ?? {};

  return (
    <div className="space-y-3 border-b border-line px-4 py-4 last:border-b-0">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
        <Icon className="size-3.5" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{elementLabel(element.type, spec.label, locale)}</span>
        {actions}
      </div>
      {spec.fields.map((field) => (
        <ElementField
          key={field.key}
          elementType={element.type}
          spec={field}
          props={props}
          onChange={(key, value) => onPropChange(element, key, value)}
        />
      ))}
    </div>
  );
}

export function SectionInspector({
  section,
  onChange,
  onDelete,
  onClose,
}: {
  section: PageSection;
  onChange: (next: PageSection) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const locale = useEditorLocale();
  const ui = editorUi(locale);
  const elements = sectionElements(section);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-sm font-medium text-ink">
            {sectionLabel(section, locale)}
          </h2>
          <p className="truncate text-xs text-ink-soft">{ui.elementCount(elements.length)}</p>
        </div>
        <Button type="button" size="icon" variant="ghost" aria-label={ui.closePanel} onClick={onClose}>
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {elements.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-soft">{ui.noElements}</p>
        ) : (
          elements.map((element) => (
            <ElementFieldset
              key={element.id}
              element={element}
              onPropChange={(el, key, value) => onChange(setElementProp(section, el, key, value))}
              actions={
                <ElementMoveButtons
                  section={section}
                  elementId={element.id}
                  label={elementLabel(element.type, ELEMENT_SPECS[element.type].label, locale)}
                  ui={ui}
                  onChange={onChange}
                />
              }
            />
          ))
        )}
      </div>

      <div className="border-t border-line px-4 py-3">
        <Button type="button" size="sm" variant="outline" className="w-full" onClick={onDelete}>
          <Trash2 className="size-4" aria-hidden />
          {ui.deleteSection}
        </Button>
      </div>
    </div>
  );
}
