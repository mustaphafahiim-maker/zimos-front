import { useState } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { Button, Input, cn } from "@store-builder/ui";
import type { PageElement } from "@store-builder/api-client";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { normalizeHex } from "@/lib/brandColors";
import { useEditorLocale } from "./editorLocale";

/**
 * The Style and Layout tabs of one element (SPEC §9.3).
 *
 *   element.settings.style    = { base, tablet, mobile }
 *   element.settings.styleRef = id of a named style
 *
 * Design happens on desktop (`base`). While tablet or mobile is selected, a
 * change is stored for that device only, and a field with nothing of its own
 * shows the value it inherits as a placeholder. Named styles live in the page
 * tree's `globalStyles.named`; an element that points at one takes its look
 * and may still override it.
 *
 * The contract (keys, ranges) is the backend's modules/pages/elementStyle.js,
 * and the storefront turns it into CSS in page-renderer/elementStyle.ts.
 */

export type StyleDevice = "base" | "tablet" | "mobile";
type Style = Record<string, unknown>;
type DeviceStyles = Partial<Record<StyleDevice, Style>>;
export interface NamedStyle {
  id: string;
  name: string;
  style: DeviceStyles;
}

const STRINGS = {
  en: {
    content: "Content",
    style: "Style",
    layout: "Layout",
    base: "Desktop",
    tablet: "Tablet",
    mobile: "Mobile",
    deviceHint: "Changes here apply to this device only.",
    color: "Text colour",
    background: "Background",
    fontSize: "Text size (px)",
    fontWeight: "Text weight",
    lineHeight: "Line height (%)",
    borderWidth: "Border width (px)",
    borderStyle: "Border type",
    borderColor: "Border colour",
    radius: "Corner radius (px)",
    shadow: "Shadow",
    opacity: "Opacity (%)",
    width: "Width (% of column)",
    maxWidth: "Maximum width (px)",
    hidden: "Hide on this device",
    align: "Alignment",
    paddingTop: "Padding top (px)",
    paddingBottom: "Padding bottom (px)",
    paddingStart: "Padding start (px)",
    paddingEnd: "Padding end (px)",
    marginTop: "Space above (px)",
    marginBottom: "Space below (px)",
    unset: "Default",
    start: "Start",
    center: "Centre",
    end: "End",
    solid: "Solid",
    dashed: "Dashed",
    dotted: "Dotted",
    none: "None",
    sm: "Small",
    md: "Medium",
    lg: "Large",
    reset: "Clear this device's changes",
    named: "Named style",
    namedNone: "None",
    namedHint: "A named style is shared: changing it restyles every element that uses it.",
    saveAs: "Save this look as a named style",
    newName: "Style name, e.g. Primary button",
    create: "Save",
    update: "Update the named style with this look",
  },
  ar: {
    content: "المحتوى",
    style: "الشكل",
    layout: "التخطيط",
    base: "ديسكتوب",
    tablet: "تابلت",
    mobile: "موبايل",
    deviceHint: "التغييرات هنا تخص هذا الجهاز فقط.",
    color: "لون النص",
    background: "الخلفية",
    fontSize: "حجم النص (px)",
    fontWeight: "سُمك النص",
    lineHeight: "ارتفاع السطر (%)",
    borderWidth: "سُمك الإطار (px)",
    borderStyle: "نوع الإطار",
    borderColor: "لون الإطار",
    radius: "استدارة الزوايا (px)",
    shadow: "الظل",
    opacity: "الشفافية (%)",
    width: "العرض (% من العمود)",
    maxWidth: "أقصى عرض (px)",
    hidden: "إخفاء على هذا الجهاز",
    align: "المحاذاة",
    paddingTop: "حشو علوي (px)",
    paddingBottom: "حشو سفلي (px)",
    paddingStart: "حشو البداية (px)",
    paddingEnd: "حشو النهاية (px)",
    marginTop: "مسافة فوق (px)",
    marginBottom: "مسافة تحت (px)",
    unset: "الافتراضي",
    start: "البداية",
    center: "الوسط",
    end: "النهاية",
    solid: "متصل",
    dashed: "متقطع",
    dotted: "منقط",
    none: "بدون",
    sm: "صغير",
    md: "متوسط",
    lg: "كبير",
    reset: "مسح تغييرات هذا الجهاز",
    named: "ستايل مسمّى",
    namedNone: "بدون",
    namedHint: "الستايل المسمّى مشترك: تغييره يغيّر كل عنصر يستخدمه.",
    saveAs: "حفظ هذا الشكل كستايل مسمّى",
    newName: "اسم الستايل، مثال: الزرار الأساسي",
    create: "حفظ",
    update: "تحديث الستايل المسمّى بهذا الشكل",
  },
} as const;
type T = (typeof STRINGS)["en"];
type Key = keyof T;

type Spec =
  | { key: Key; kind: "number"; min: number; max: number }
  | { key: Key; kind: "colour" }
  | { key: Key; kind: "select"; options: Array<{ value: string; label: Key }>; numeric?: boolean };

const STYLE_FIELDS: Spec[] = [
  { key: "color", kind: "colour" },
  { key: "background", kind: "colour" },
  { key: "fontSize", kind: "number", min: 8, max: 160 },
  {
    key: "fontWeight",
    kind: "select",
    numeric: true,
    options: [300, 400, 500, 600, 700, 800, 900].map((w) => ({ value: String(w), label: String(w) as Key })),
  },
  { key: "lineHeight", kind: "number", min: 80, max: 300 },
  { key: "borderWidth", kind: "number", min: 0, max: 20 },
  {
    key: "borderStyle",
    kind: "select",
    options: [
      { value: "solid", label: "solid" },
      { value: "dashed", label: "dashed" },
      { value: "dotted", label: "dotted" },
      { value: "none", label: "none" },
    ],
  },
  { key: "borderColor", kind: "colour" },
  { key: "radius", kind: "number", min: 0, max: 200 },
  {
    key: "shadow",
    kind: "select",
    options: [
      { value: "none", label: "none" },
      { value: "sm", label: "sm" },
      { value: "md", label: "md" },
      { value: "lg", label: "lg" },
    ],
  },
  { key: "opacity", kind: "number", min: 0, max: 100 },
];

const LAYOUT_FIELDS: Spec[] = [
  {
    key: "align",
    kind: "select",
    options: [
      { value: "start", label: "start" },
      { value: "center", label: "center" },
      { value: "end", label: "end" },
    ],
  },
  { key: "width", kind: "number", min: 5, max: 100 },
  { key: "maxWidth", kind: "number", min: 50, max: 2000 },
  { key: "paddingTop", kind: "number", min: 0, max: 300 },
  { key: "paddingBottom", kind: "number", min: 0, max: 300 },
  { key: "paddingStart", kind: "number", min: 0, max: 300 },
  { key: "paddingEnd", kind: "number", min: 0, max: 300 },
  { key: "marginTop", kind: "number", min: 0, max: 300 },
  { key: "marginBottom", kind: "number", min: 0, max: 300 },
];

const DEVICES: Array<{ id: StyleDevice; icon: typeof Monitor }> = [
  { id: "base", icon: Monitor },
  { id: "tablet", icon: Tablet },
  { id: "mobile", icon: Smartphone },
];

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function elementStyles(element: PageElement): DeviceStyles {
  const raw = isObject(element.settings) ? element.settings.style : null;
  if (!isObject(raw)) return {};
  const out: DeviceStyles = {};
  for (const device of ["base", "tablet", "mobile"] as const) {
    if (isObject(raw[device])) out[device] = raw[device] as Style;
  }
  return out;
}

/** Named styles of a page tree's `globalStyles`, ignoring anything malformed. */
export function namedStylesOf(globalStyles: unknown): NamedStyle[] {
  const named = isObject(globalStyles) ? globalStyles.named : null;
  if (!Array.isArray(named)) return [];
  return named.filter(
    (n): n is NamedStyle => isObject(n) && typeof n.id === "string" && typeof n.name === "string" && isObject(n.style)
  );
}

/** Drops empty devices and an empty style, so an untouched element stays untouched. */
function compact(styles: DeviceStyles): DeviceStyles | undefined {
  const out: DeviceStyles = {};
  for (const device of ["base", "tablet", "mobile"] as const) {
    const style = styles[device];
    if (style && Object.keys(style).length > 0) out[device] = style;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function withStyles(element: PageElement, styles: DeviceStyles, styleRef: string | undefined): Record<string, unknown> | undefined {
  const { style: _style, styleRef: _ref, ...rest } = (isObject(element.settings) ? element.settings : {}) as Record<string, unknown>;
  void _style;
  void _ref;
  const next: Record<string, unknown> = { ...rest };
  const compacted = compact(styles);
  if (compacted) next.style = compacted;
  if (styleRef) next.styleRef = styleRef;
  return Object.keys(next).length > 0 ? next : undefined;
}

export function ElementStylePanel({
  element,
  tab,
  named,
  onSettingsChange,
  onNamedChange,
}: {
  element: PageElement;
  tab: "style" | "layout";
  named: NamedStyle[];
  onSettingsChange: (settings: Record<string, unknown> | undefined) => void;
  /** Absent where named styles cannot be saved (the funnel step editor). */
  onNamedChange?: (next: NamedStyle[]) => void;
}) {
  const locale = useEditorLocale();
  const t: T = STRINGS[locale] as unknown as T;
  const [device, setDevice] = useState<StyleDevice>("base");
  const [newName, setNewName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const styles = elementStyles(element);
  const styleRef = isObject(element.settings) && typeof element.settings.styleRef === "string" ? element.settings.styleRef : "";
  const refStyle = named.find((n) => n.id === styleRef)?.style ?? {};
  const own = styles[device] ?? {};
  // What a field shows when this device has nothing of its own for it.
  const inherited = (key: string): unknown =>
    device === "base"
      ? refStyle.base?.[key]
      : (styles.base?.[key] ?? refStyle[device]?.[key] ?? refStyle.base?.[key]);

  function setValue(key: string, value: unknown) {
    const nextDevice: Style = { ...own };
    if (value === undefined || value === "") delete nextDevice[key];
    else nextDevice[key] = value;
    onSettingsChange(withStyles(element, { ...styles, [device]: nextDevice }, styleRef || undefined));
  }

  function field(spec: Spec) {
    const value = own[spec.key];
    const fallback = inherited(spec.key);
    const draftKey = `${device}:${spec.key}`;
    if (spec.kind === "number") {
      return (
        <Field key={spec.key} label={t[spec.key]}>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              inputMode="numeric"
              min={spec.min}
              max={spec.max}
              placeholder={typeof fallback === "number" ? String(fallback) : undefined}
              value={typeof value === "number" ? value : ""}
              onChange={(e) => {
                if (e.target.value === "") return setValue(spec.key, undefined);
                const n = Math.round(Number(e.target.value));
                if (Number.isFinite(n)) setValue(spec.key, Math.min(spec.max, Math.max(spec.min, n)));
              }}
            />
          )}
        </Field>
      );
    }
    if (spec.kind === "colour") {
      const shown = drafts[draftKey] ?? (typeof value === "string" ? value : "");
      const valid = normalizeHex(shown);
      return (
        <Field key={spec.key} label={t[spec.key]}>
          {({ id }) => (
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label={t[spec.key]}
                value={valid ?? (typeof fallback === "string" ? (normalizeHex(fallback) ?? "#000000") : "#000000")}
                onChange={(e) => {
                  setDrafts((prev) => ({ ...prev, [draftKey]: e.target.value }));
                  setValue(spec.key, e.target.value.toLowerCase());
                }}
                className="size-10 shrink-0 cursor-pointer rounded-[0.5rem] border border-line-strong bg-paper-raised p-1"
              />
              <Input
                id={id}
                dir="ltr"
                spellCheck={false}
                placeholder={typeof fallback === "string" ? fallback : "#"}
                value={shown}
                onChange={(e) => {
                  const text = e.target.value;
                  setDrafts((prev) => ({ ...prev, [draftKey]: text }));
                  // Only a complete hex colour is stored; an emptied box clears it.
                  const hex = normalizeHex(text);
                  if (text.trim() === "") setValue(spec.key, undefined);
                  else if (hex) setValue(spec.key, hex.toLowerCase());
                }}
              />
            </div>
          )}
        </Field>
      );
    }
    return (
      <Field key={spec.key} label={t[spec.key]}>
        {({ id }) => (
          <Select
            id={id}
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(e) =>
              setValue(spec.key, e.target.value === "" ? undefined : spec.numeric ? Number(e.target.value) : e.target.value)
            }
          >
            <option value="">
              {t.unset}
              {fallback !== undefined && fallback !== null ? ` (${String(fallback)})` : ""}
            </option>
            {spec.options.map((o) => (
              <option key={o.value} value={o.value}>
                {(t as Record<string, string>)[o.label] ?? o.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
    );
  }

  const fields = tab === "style" ? STYLE_FIELDS : LAYOUT_FIELDS;
  const hasOwn = Object.keys(own).length > 0;

  return (
    <div className="space-y-3">
      <div role="group" aria-label={t.base} className="inline-flex gap-1 rounded-[0.5rem] border border-line bg-paper-raised p-1">
        {DEVICES.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={device === id}
            title={t[id]}
            onClick={() => setDevice(id)}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-[0.375rem] px-2.5 py-1.5 text-xs font-medium",
              device === id ? "bg-primary-soft text-primary-dark dark:text-primary" : "text-ink-soft hover:text-ink"
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {t[id]}
            {/* A dot marks a device that carries changes of its own. */}
            {styles[id] && Object.keys(styles[id] ?? {}).length > 0 && <span className="size-1.5 rounded-full bg-primary" aria-hidden />}
          </button>
        ))}
      </div>
      {device !== "base" && <p className="text-xs text-ink-soft">{t.deviceHint}</p>}

      {fields.map(field)}

      {tab === "style" && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={own.hidden === true}
            onChange={(e) => setValue("hidden", e.target.checked ? true : device === "base" ? undefined : false)}
          />
          {t.hidden}
        </label>
      )}

      {hasOwn && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setDrafts({});
            onSettingsChange(withStyles(element, { ...styles, [device]: {} }, styleRef || undefined));
          }}
        >
          {t.reset}
        </Button>
      )}

      {tab === "style" && (
        <div className="space-y-2 border-t border-line pt-3">
          <Field label={t.named} hint={t.namedHint}>
            {({ id }) => (
              <Select
                id={id}
                value={styleRef}
                onChange={(e) => onSettingsChange(withStyles(element, styles, e.target.value || undefined))}
              >
                <option value="">{t.namedNone}</option>
                {named.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {onNamedChange && styleRef && compact(styles) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                // The element's own look moves into the shared style; the element keeps only the reference.
                onNamedChange(
                  named.map((n) =>
                    n.id === styleRef
                      ? {
                          ...n,
                          style: {
                            base: { ...n.style.base, ...styles.base },
                            tablet: { ...n.style.tablet, ...styles.tablet },
                            mobile: { ...n.style.mobile, ...styles.mobile },
                          },
                        }
                      : n
                  )
                );
                onSettingsChange(withStyles(element, {}, styleRef));
              }}
            >
              {t.update}
            </Button>
          )}
          {onNamedChange && compact(styles) && named.length < 40 && (
            <div className="flex items-center gap-2">
              <Input
                aria-label={t.saveAs}
                placeholder={t.newName}
                maxLength={80}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                disabled={!newName.trim()}
                title={t.saveAs}
                onClick={() => {
                  const id = `s-${Math.random().toString(36).slice(2, 10)}`;
                  onNamedChange([...named, { id, name: newName.trim(), style: compact(styles) ?? {} }]);
                  onSettingsChange(withStyles(element, {}, id));
                  setNewName("");
                }}
              >
                {t.create}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The Content / Style / Layout switch above an element's fields. */
export function ElementTabs({
  value,
  onChange,
}: {
  value: "content" | "style" | "layout";
  onChange: (tab: "content" | "style" | "layout") => void;
}) {
  const locale = useEditorLocale();
  const t = STRINGS[locale];
  return (
    <div role="tablist" className="flex gap-1 border-b border-line">
      {(["content", "style", "layout"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={value === tab}
          onClick={() => onChange(tab)}
          className={cn(
            "-mb-px cursor-pointer border-b-2 px-3 py-1.5 text-xs font-medium",
            value === tab ? "border-primary text-primary" : "border-transparent text-ink-soft hover:text-ink"
          )}
        >
          {t[tab]}
        </button>
      ))}
    </div>
  );
}
