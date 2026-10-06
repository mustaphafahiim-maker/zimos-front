import { useState } from "react";
import { Input } from "@store-builder/ui";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { normalizeHex } from "@/lib/brandColors";
import { useEditorLocale } from "./editorLocale";
import { ImageField } from "./ImageField";

/**
 * The rest of an element's Style and Layout tabs (SPEC §9.3, Lightfunnels'
 * element styles): gradient and image backgrounds, a custom shadow,
 * overflow, cursor, hiding on a phone held upright or sideways, and the
 * height / min / max sizes. Rendered inside ElementStylePanel, which owns
 * the device and the stored style; the contract is the backend's
 * modules/pages/styleExtras.js and the storefront's elementStyleExtras.ts.
 */

const STRINGS = {
  en: {
    backgroundTitle: "Gradient and image",
    gradientFrom: "Gradient start colour",
    gradientTo: "Gradient end colour",
    gradientAngle: "Gradient angle (°)",
    backgroundImage: "Background image",
    backgroundImageHint: "The gradient, when set, lies over the image.",
    backgroundSize: "Image fit",
    cover: "Fill the box",
    contain: "Show it whole",
    auto: "Original size",
    backgroundPosition: "Image position",
    center: "Centre",
    top: "Top",
    bottom: "Bottom",
    start: "Start",
    end: "End",
    shadowTitle: "Custom shadow",
    shadowHint: "Set a colour to use it; it replaces the shadow chosen above.",
    shadowColor: "Shadow colour",
    shadowX: "Across (px)",
    shadowY: "Down (px)",
    shadowBlur: "Blur (px)",
    shadowSpread: "Spread (px)",
    shadowInset: "Inner shadow",
    overflow: "Overflowing content",
    visible: "Show it",
    hidden: "Cut it off",
    scroll: "Scroll",
    cursor: "Pointer",
    cursorAuto: "Automatic",
    cursorDefault: "Arrow",
    cursorPointer: "Hand",
    cursorText: "Text",
    cursorNotAllowed: "Not allowed",
    hiddenPortrait: "Hide when the phone is upright",
    hiddenLandscape: "Hide when the phone is sideways",
    height: "Height (px)",
    minHeight: "Minimum height (px)",
    maxHeight: "Maximum height (px)",
    minWidth: "Minimum width (px)",
    unset: "Default",
  },
  ar: {
    backgroundTitle: "التدرّج والصورة",
    gradientFrom: "لون بداية التدرّج",
    gradientTo: "لون نهاية التدرّج",
    gradientAngle: "زاوية التدرّج (°)",
    backgroundImage: "صورة الخلفية",
    backgroundImageHint: "التدرّج، لو موجود، بيكون فوق الصورة.",
    backgroundSize: "ملاءمة الصورة",
    cover: "تملأ المساحة",
    contain: "تظهر كاملة",
    auto: "حجمها الأصلي",
    backgroundPosition: "مكان الصورة",
    center: "الوسط",
    top: "فوق",
    bottom: "تحت",
    start: "البداية",
    end: "النهاية",
    shadowTitle: "ظل مخصص",
    shadowHint: "اختار لون علشان يشتغل؛ بيحل محل الظل اللي فوق.",
    shadowColor: "لون الظل",
    shadowX: "أفقي (px)",
    shadowY: "رأسي (px)",
    shadowBlur: "التمويه (px)",
    shadowSpread: "الانتشار (px)",
    shadowInset: "ظل داخلي",
    overflow: "المحتوى الزايد",
    visible: "يظهر",
    hidden: "يتقص",
    scroll: "سكرول",
    cursor: "شكل المؤشر",
    cursorAuto: "تلقائي",
    cursorDefault: "سهم",
    cursorPointer: "إيد",
    cursorText: "نص",
    cursorNotAllowed: "غير مسموح",
    hiddenPortrait: "إخفاء والموبايل واقف",
    hiddenLandscape: "إخفاء والموبايل نايم",
    height: "الارتفاع (px)",
    minHeight: "أقل ارتفاع (px)",
    maxHeight: "أقصى ارتفاع (px)",
    minWidth: "أقل عرض (px)",
    unset: "الافتراضي",
  },
} as const;
type T = (typeof STRINGS)["en"];
type Style = Record<string, unknown>;

export function StyleExtrasFields({
  tab,
  device,
  own,
  inherited,
  setValue,
}: {
  tab: "style" | "layout";
  device: "base" | "tablet" | "mobile";
  own: Style;
  inherited: (key: string) => unknown;
  setValue: (key: string, value: unknown) => void;
}) {
  const t: T = STRINGS[useEditorLocale()] as unknown as T;
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const number = (key: keyof T & string, min: number, max: number) => {
    const value = own[key];
    const fallback = inherited(key);
    return (
      <Field key={key} label={t[key]}>
        {({ id }) => (
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            placeholder={typeof fallback === "number" ? String(fallback) : undefined}
            value={typeof value === "number" ? value : ""}
            onChange={(e) => {
              if (e.target.value === "") return setValue(key, undefined);
              const n = Math.round(Number(e.target.value));
              if (Number.isFinite(n)) setValue(key, Math.min(max, Math.max(min, n)));
            }}
          />
        )}
      </Field>
    );
  };

  const colour = (key: keyof T & string) => {
    const draftKey = `${device}:${key}`;
    const value = own[key];
    const fallback = inherited(key);
    const shown = drafts[draftKey] ?? (typeof value === "string" ? value : "");
    const valid = normalizeHex(shown);
    return (
      <Field key={key} label={t[key]}>
        {({ id }) => (
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label={t[key]}
              value={valid ?? (typeof fallback === "string" ? (normalizeHex(fallback) ?? "#000000") : "#000000")}
              onChange={(e) => {
                setDrafts((prev) => ({ ...prev, [draftKey]: e.target.value }));
                setValue(key, e.target.value.toLowerCase());
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
                const hex = normalizeHex(text);
                if (text.trim() === "") setValue(key, undefined);
                else if (hex) setValue(key, hex.toLowerCase());
              }}
            />
          </div>
        )}
      </Field>
    );
  };

  const select = (key: keyof T & string, options: Array<[string, keyof T]>) => {
    const value = own[key];
    const fallback = inherited(key);
    return (
      <Field key={key} label={t[key]}>
        {({ id }) => (
          <Select id={id} value={typeof value === "string" ? value : ""} onChange={(e) => setValue(key, e.target.value || undefined)}>
            <option value="">
              {t.unset}
              {typeof fallback === "string" ? ` (${t[options.find(([v]) => v === fallback)?.[1] ?? "unset"]})` : ""}
            </option>
            {options.map(([v, label]) => (
              <option key={v} value={v}>
                {t[label]}
              </option>
            ))}
          </Select>
        )}
      </Field>
    );
  };

  const check = (key: keyof T & string) => (
    <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
      <input type="checkbox" className="size-4 accent-primary" checked={own[key] === true} onChange={(e) => setValue(key, e.target.checked ? true : undefined)} />
      {t[key]}
    </label>
  );

  if (tab === "layout") {
    return (
      <>
        {number("height", 0, 2000)}
        {number("minHeight", 0, 2000)}
        {number("maxHeight", 0, 4000)}
        {number("minWidth", 0, 2000)}
      </>
    );
  }

  const image = typeof own.backgroundImage === "string" ? own.backgroundImage : "";
  return (
    <>
      {device === "mobile" && (
        <div className="space-y-2">
          {check("hiddenPortrait")}
          {check("hiddenLandscape")}
        </div>
      )}

      <fieldset className="space-y-3 border-t border-line pt-3">
        <legend className="pt-3 text-xs font-semibold text-ink">{t.backgroundTitle}</legend>
        {colour("gradientFrom")}
        {colour("gradientTo")}
        {number("gradientAngle", 0, 360)}
        <ImageField label={t.backgroundImage} hint={t.backgroundImageHint} value={image} onChange={(url) => setValue("backgroundImage", url || undefined)} />
        {image && select("backgroundSize", [["cover", "cover"], ["contain", "contain"], ["auto", "auto"]])}
        {image && select("backgroundPosition", [["center", "center"], ["top", "top"], ["bottom", "bottom"], ["start", "start"], ["end", "end"]])}
      </fieldset>

      <fieldset className="space-y-3 border-t border-line pt-3">
        <legend className="pt-3 text-xs font-semibold text-ink">{t.shadowTitle}</legend>
        <p className="text-xs text-ink-soft">{t.shadowHint}</p>
        {colour("shadowColor")}
        <div className="grid grid-cols-2 gap-2">
          {number("shadowX", -100, 100)}
          {number("shadowY", -100, 100)}
          {number("shadowBlur", 0, 200)}
          {number("shadowSpread", -100, 100)}
        </div>
        {check("shadowInset")}
      </fieldset>

      <div className="space-y-3 border-t border-line pt-3">
        {select("overflow", [["visible", "visible"], ["hidden", "hidden"], ["auto", "scroll"]])}
        {select("cursor", [["auto", "cursorAuto"], ["default", "cursorDefault"], ["pointer", "cursorPointer"], ["text", "cursorText"], ["not-allowed", "cursorNotAllowed"]])}
      </div>
    </>
  );
}
