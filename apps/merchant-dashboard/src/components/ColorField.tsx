import { useId, type ReactNode } from "react";
import { IconCheck } from "@/components/icons";
import { Input, Label, cn } from "@store-builder/ui";
import { BRAND_COLOR_PRESETS, normalizeHex } from "@/lib/brandColors";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    picker: "{label} colour picker",
    hex: "{label}: colour code",
    use: "Use {color}",
    invalid: "Enter a colour code like {example}.",
  },
  ar: {
    picker: "{label}: اختار لون",
    hex: "{label}: كود اللون",
    use: "استخدم {color}",
    invalid: "اكتب كود لون زي {example}.",
  },
} satisfies Messages;

const EXAMPLE = "#1F5D5B";

/**
 * A colour swatch + native picker + hex text box + preset row, all bound to one
 * hex string. The text box accepts partial typing, so it stays uncontrolled-ish:
 * `onChange` only fires with a valid `#RRGGBB`, while the raw keystrokes live in
 * the parent's draft value.
 */
export function ColorField({
  label,
  icon,
  hint,
  value,
  onChange,
}: {
  label: string;
  /** Drawn before the label, e.g. a sun or moon for a per-mode colour. */
  icon?: ReactNode;
  hint?: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const t = useT(STRINGS);
  const id = useId();
  const valid = normalizeHex(value);
  // Keep the native picker on the last valid colour — it cannot show a partial hex.
  const swatch = valid ?? "#000000";
  // The example code is drawn left-to-right on its own, so its # stays in front in Arabic.
  const [invalidBefore, invalidAfter] = t.invalid.split("{example}");

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={icon ? "inline-flex items-center gap-1.5" : undefined}>
        {icon}
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          aria-label={fmt(t.picker, { label })}
          value={swatch}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="size-10 shrink-0 cursor-pointer rounded-[0.5rem] border border-line-strong bg-paper-raised p-1"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => valid && onChange(valid)}
          spellCheck={false}
          dir="ltr"
          aria-label={fmt(t.hex, { label })}
          aria-invalid={valid ? undefined : true}
          placeholder={EXAMPLE}
          className={cn("w-32 font-mono uppercase", !valid && "border-danger focus-visible:ring-danger/30")}
        />
      </div>

      <div className="flex flex-wrap gap-2 sm:gap-1.5">
        {BRAND_COLOR_PRESETS.map((preset) => {
          const active = valid === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              title={preset}
              aria-label={fmt(t.use, { color: preset })}
              aria-pressed={active}
              className={cn(
                "cursor-pointer flex size-11 items-center justify-center rounded-full border transition-transform hover:scale-110 sm:size-7",
                active ? "border-ink" : "border-line"
              )}
              style={{ backgroundColor: preset }}
            >
              {active && <IconCheck className="size-3.5 text-white drop-shadow" aria-hidden />}
            </button>
          );
        })}
      </div>

      {valid ? (
        hint && <p className="text-xs text-ink-soft">{hint}</p>
      ) : (
        <p className="text-xs font-medium text-danger">
          {invalidBefore}
          <bdi dir="ltr">{EXAMPLE}</bdi>
          {invalidAfter}
        </p>
      )}
    </div>
  );
}
