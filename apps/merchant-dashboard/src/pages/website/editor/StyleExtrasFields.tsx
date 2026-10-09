import type { ReactNode } from "react";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { useEditorLocale } from "./editorLocale";
import { ImageField } from "./ImageField";
import { FontSelect, useStoreFonts } from "./FontSelect";
import { ColourControl, NumberField, SwitchRow } from "./inspector/controls";

/**
 * The rest of an element's look (SPEC §9.3, Lightfunnels' element styles):
 * its font, gradient and image backgrounds, a custom shadow, overflow,
 * cursor, hiding on a phone held upright or sideways, and the height / min /
 * max sizes. Rendered inside ElementStylePanel, which owns the device and
 * the stored style; the contract is the backend's
 * modules/pages/styleExtras.js and the storefront's elementStyleExtras.ts.
 *
 * With `part` it draws one piece only, bare, for the group that asks (the
 * inspector's Style page sorts the pieces under Text, Background, Shadow…);
 * without it, everything the old Style or Layout tab held, as before.
 */

const STRINGS = {
  en: {
    fontFamily: "Font",
    storeFont: "The store's font",
    backgroundTitle: "Gradient and image",
    gradientFrom: "Gradient: first colour",
    gradientTo: "Gradient: second colour",
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
    shadowColor: "Custom shadow colour",
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
    minHeight: "Shortest (px)",
    maxHeight: "Tallest (px)",
    minWidth: "Narrowest (px)",
    unset: "Default",
  },
  ar: {
    fontFamily: "الخط",
    storeFont: "خط المتجر",
    backgroundTitle: "التدرّج والصورة",
    gradientFrom: "التدرّج: اللون الأول",
    gradientTo: "التدرّج: اللون التاني",
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
    shadowColor: "لون الظل المخصص",
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

/** The pieces the extras fall into; each is one block of controls. */
export type StyleExtrasPart = "font" | "background" | "shadow" | "advanced" | "sizes" | "orientation";

/** The style keys each piece writes — what a group counts to say how much of it is set. */
export const STYLE_EXTRAS_KEYS: Record<StyleExtrasPart, readonly string[]> = {
  font: ["fontFamily"],
  background: ["gradientFrom", "gradientTo", "gradientAngle", "backgroundImage", "backgroundSize", "backgroundPosition"],
  shadow: ["shadowColor", "shadowX", "shadowY", "shadowBlur", "shadowSpread", "shadowInset"],
  advanced: ["overflow", "cursor"],
  sizes: ["height", "minHeight", "maxHeight", "minWidth"],
  orientation: ["hiddenPortrait", "hiddenLandscape"],
};

export function StyleExtrasFields({
  tab,
  device,
  own,
  inherited,
  setValue,
  part,
}: {
  tab: "style" | "layout";
  device: "base" | "tablet" | "mobile";
  own: Style;
  inherited: (key: string) => unknown;
  setValue: (key: string, value: unknown) => void;
  /** One piece only, without its heading. Left out: every piece of `tab`, as before. */
  part?: StyleExtrasPart;
}) {
  const t: T = STRINGS[useEditorLocale()] as unknown as T;
  const fonts = useStoreFonts();

  const number = (key: keyof T & string, min: number, max: number, step = 1) => {
    const value = own[key];
    const fallback = inherited(key);
    return (
      <NumberField
        key={`${device}:${key}`}
        label={t[key]}
        strict
        integer
        min={min}
        max={max}
        step={step}
        placeholder={typeof fallback === "number" ? String(fallback) : undefined}
        startAt={typeof fallback === "number" ? fallback : undefined}
        value={typeof value === "number" ? value : ""}
        onChange={(next) => setValue(key, next === "" ? undefined : next)}
      />
    );
  };

  const colour = (key: keyof T & string) => {
    const value = own[key];
    const fallback = inherited(key);
    return (
      <ColourControl
        key={`${device}:${key}`}
        label={t[key]}
        value={typeof value === "string" ? value : undefined}
        fallback={typeof fallback === "string" ? fallback : undefined}
        onChange={(hex) => setValue(key, hex)}
      />
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
    <SwitchRow key={key} label={t[key]} checked={own[key] === true} onChange={(checked) => setValue(key, checked ? true : undefined)} />
  );

  const image = typeof own.backgroundImage === "string" ? own.backgroundImage : "";
  const font = typeof own.fontFamily === "string" ? own.fontFamily : "";
  const inheritedFont = inherited("fontFamily");

  const pieces: Record<StyleExtrasPart, () => ReactNode> = {
    font: () => (
      <Field label={t.fontFamily}>
        {({ id }) => (
          <FontSelect
            id={id}
            value={font}
            emptyLabel={typeof inheritedFont === "string" ? `${t.unset} (${inheritedFont.replace(/^[gc]:/, "")})` : t.storeFont}
            uploaded={fonts.data ?? []}
            onChange={(ref) => setValue("fontFamily", ref || undefined)}
          />
        )}
      </Field>
    ),
    orientation: () => (
      <div>
        {check("hiddenPortrait")}
        {check("hiddenLandscape")}
      </div>
    ),
    background: () => (
      <>
        {colour("gradientFrom")}
        {colour("gradientTo")}
        {number("gradientAngle", 0, 360, 15)}
        <ImageField label={t.backgroundImage} hint={t.backgroundImageHint} value={image} onChange={(url) => setValue("backgroundImage", url || undefined)} />
        {image && select("backgroundSize", [["cover", "cover"], ["contain", "contain"], ["auto", "auto"]])}
        {image && select("backgroundPosition", [["center", "center"], ["top", "top"], ["bottom", "bottom"], ["start", "start"], ["end", "end"]])}
      </>
    ),
    shadow: () => (
      <>
        {colour("shadowColor")}
        <p className="text-xs leading-5 text-ink-soft">{t.shadowHint}</p>
        <div className="grid grid-cols-2 items-end gap-x-2 gap-y-3">
          {number("shadowX", -100, 100)}
          {number("shadowY", -100, 100)}
          {number("shadowBlur", 0, 200, 2)}
          {number("shadowSpread", -100, 100)}
        </div>
        {check("shadowInset")}
      </>
    ),
    advanced: () => (
      <>
        {select("overflow", [["visible", "visible"], ["hidden", "hidden"], ["auto", "scroll"]])}
        {select("cursor", [["auto", "cursorAuto"], ["default", "cursorDefault"], ["pointer", "cursorPointer"], ["text", "cursorText"], ["not-allowed", "cursorNotAllowed"]])}
      </>
    ),
    sizes: () => (
      <div className="grid grid-cols-2 items-end gap-x-2 gap-y-3">
        {number("height", 0, 2000, 10)}
        {number("minHeight", 0, 2000, 10)}
        {number("maxHeight", 0, 4000, 10)}
        {number("minWidth", 0, 2000, 10)}
      </div>
    ),
  };

  if (part) return <>{pieces[part]()}</>;

  if (tab === "layout") return <>{pieces.sizes()}</>;

  return (
    <>
      {pieces.font()}
      {device === "mobile" && pieces.orientation()}
      <fieldset className="min-w-0 space-y-3 border-t border-line pt-3">
        <legend className="pt-3 text-[13px] font-semibold text-ink">{t.backgroundTitle}</legend>
        {pieces.background()}
      </fieldset>
      <fieldset className="min-w-0 space-y-3 border-t border-line pt-3">
        <legend className="pt-3 text-[13px] font-semibold text-ink">{t.shadowTitle}</legend>
        {pieces.shadow()}
      </fieldset>
      <div className="space-y-3 border-t border-line pt-3">{pieces.advanced()}</div>
    </>
  );
}
