import { Input } from "@store-builder/ui";
import type { PageElement } from "@store-builder/api-client";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { useEditorLocale } from "./editorLocale";

/**
 * An element's entrance animation, in the Style tab (SPEC §9.3; backend
 * modules/pages/elementAnimation.js): `settings.animation = { type,
 * duration, delay }`. It plays once when the element scrolls into view, on
 * every device, and not for shoppers who ask their device for less motion.
 */

const STRINGS = {
  en: {
    title: "Entrance animation",
    hint: "Plays once when the element first scrolls into view. Shoppers who turned motion down see it without the animation.",
    type: "Animation",
    none: "None",
    fade: "Fade in",
    "slide-up": "Slide up",
    "slide-down": "Slide down",
    "slide-start": "Slide in from the start",
    "slide-end": "Slide in from the end",
    "zoom-in": "Zoom in",
    "zoom-out": "Zoom out",
    duration: "Duration (ms)",
    delay: "Delay (ms)",
  },
  ar: {
    title: "حركة الظهور",
    hint: "بتشتغل مرة واحدة أول ما العنصر يظهر في الشاشة. اللي قافلين الحركة في أجهزتهم بيشوفوه من غيرها.",
    type: "الحركة",
    none: "بدون",
    fade: "ظهور تدريجي",
    "slide-up": "انزلاق لفوق",
    "slide-down": "انزلاق لتحت",
    "slide-start": "دخول من البداية",
    "slide-end": "دخول من النهاية",
    "zoom-in": "تكبير",
    "zoom-out": "تصغير",
    duration: "المدة (ms)",
    delay: "التأخير (ms)",
  },
} as const;

const TYPES = ["fade", "slide-up", "slide-down", "slide-start", "slide-end", "zoom-in", "zoom-out"] as const;
type Animation = { type: string; duration?: number; delay?: number };

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function AnimationFields({
  element,
  onSettingsChange,
}: {
  element: PageElement;
  onSettingsChange: (settings: Record<string, unknown> | undefined) => void;
}) {
  const t = STRINGS[useEditorLocale()];
  const settings = isObject(element.settings) ? element.settings : {};
  const current = isObject(settings.animation) ? (settings.animation as Animation) : null;

  function set(next: Animation | null) {
    const rest: Record<string, unknown> = { ...settings };
    if (next) rest.animation = next;
    else delete rest.animation;
    onSettingsChange(Object.keys(rest).length > 0 ? rest : undefined);
  }

  const number = (key: "duration" | "delay", min: number, max: number, placeholder: number) => (
    <Field label={t[key]}>
      {({ id }) => (
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={100}
          placeholder={String(placeholder)}
          value={typeof current?.[key] === "number" ? current[key] : ""}
          onChange={(e) => {
            if (!current) return;
            const { [key]: _drop, ...rest } = current;
            void _drop;
            if (e.target.value === "") return set(rest as Animation);
            const n = Math.round(Number(e.target.value));
            if (Number.isFinite(n)) set({ ...rest, [key]: Math.min(max, Math.max(min, n)) } as Animation);
          }}
        />
      )}
    </Field>
  );

  return (
    <fieldset className="space-y-3 border-t border-line pt-3">
      <legend className="pt-3 text-xs font-semibold text-ink">{t.title}</legend>
      <p className="text-xs text-ink-soft">{t.hint}</p>
      <Field label={t.type}>
        {({ id }) => (
          <Select id={id} value={current?.type ?? ""} onChange={(e) => set(e.target.value ? { ...(current ?? {}), type: e.target.value } : null)}>
            <option value="">{t.none}</option>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {t[type]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {current && (
        <div className="grid grid-cols-2 gap-2">
          {number("duration", 100, 3000, 600)}
          {number("delay", 0, 5000, 0)}
        </div>
      )}
    </fieldset>
  );
}
