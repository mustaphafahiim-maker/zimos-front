import { useState } from "react";
import { Check } from "lucide-react";
import { Label, cn } from "@store-builder/ui";
import { ColorField } from "@/components/ColorField";
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY, normalizeHex } from "@/lib/brandColors";
import { ImageField } from "./ImageField";
import { editorUi, useEditorLocale } from "./editorLocale";
import { FONT_OPTIONS, PALETTES, RADIUS_OPTIONS, type StoreLook } from "./storeLook";

/**
 * The inspector's "Store look" tab: colours, font, corners and logo for the
 * whole store. Every change goes straight into the live preview (as an
 * unsaved look the frame lays over the saved one) and is written to the
 * workspace only when the editor saves — see storeLook.ts for the keys.
 *
 * `onChange` takes a history key so a burst of typing in a hex box, or a drag
 * across the native colour picker, is one undo step.
 */
export function StoreLookPanel({
  look,
  onChange,
}: {
  look: StoreLook;
  onChange: (next: StoreLook, historyKey?: string) => void;
}) {
  const ui = editorUi(useEditorLocale());

  return (
    <div className="space-y-6 px-4 py-4">
      <p className="text-xs text-ink-soft">{ui.lookHint}</p>

      <section className="space-y-2">
        <Label>{ui.palettes}</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {PALETTES.map((palette) => {
            const name = ui.paletteName(palette.key);
            const active = look.primaryColor === palette.primary && look.secondaryColor === palette.secondary;
            return (
              <button
                key={palette.key}
                type="button"
                aria-pressed={active}
                aria-label={ui.usePalette(name)}
                onClick={() =>
                  onChange({ ...look, primaryColor: palette.primary, secondaryColor: palette.secondary })
                }
                className={cn(
                  "cursor-pointer flex items-center gap-2 rounded-[0.5rem] border px-2 py-1.5 text-start text-xs font-medium text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  active ? "border-primary bg-primary-soft" : "border-line hover:border-primary/50"
                )}
              >
                <span className="flex shrink-0 overflow-hidden rounded-full border border-line" aria-hidden>
                  <span className="size-4" style={{ backgroundColor: palette.primary }} />
                  <span className="size-4" style={{ backgroundColor: palette.secondary }} />
                </span>
                <span className="min-w-0 flex-1 truncate">{name}</span>
                {active && <Check className="size-3.5 shrink-0 text-primary" aria-hidden />}
              </button>
            );
          })}
        </div>
      </section>

      <LookColor
        label={ui.primaryColor}
        hint={look.primaryColor ? ui.primaryColorHint : ui.storeDefaultColor}
        value={look.primaryColor}
        fallback={DEFAULT_PRIMARY}
        onChange={(hex) => onChange({ ...look, primaryColor: hex }, "look:primary")}
      />
      <LookColor
        label={ui.accentColor}
        hint={look.secondaryColor ? ui.accentColorHint : ui.storeDefaultColor}
        value={look.secondaryColor}
        fallback={DEFAULT_SECONDARY}
        onChange={(hex) => onChange({ ...look, secondaryColor: hex }, "look:secondary")}
      />

      <section className="space-y-2">
        <Label>{ui.font}</Label>
        <div role="radiogroup" aria-label={ui.font} className="grid grid-cols-2 gap-1.5">
          {FONT_OPTIONS.map((font) => {
            const active = look.fontFamily === font.value;
            return (
              <button
                key={font.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ ...look, fontFamily: font.value })}
                className={cn(
                  "cursor-pointer rounded-[0.5rem] border px-2.5 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  active ? "border-primary bg-primary-soft" : "border-line hover:border-primary/50"
                )}
              >
                <span className="block text-lg leading-tight text-ink" style={{ fontFamily: font.heading }}>
                  Aa أب
                </span>
                <span className="block text-xs text-ink-soft" style={{ fontFamily: font.body }}>
                  {ui.fontName(font.value)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <Label>{ui.corners}</Label>
        <div role="radiogroup" aria-label={ui.corners} className="grid grid-cols-3 gap-1.5">
          {RADIUS_OPTIONS.map((option) => {
            const active = look.cornerRadius === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ ...look, cornerRadius: option.value })}
                className={cn(
                  "cursor-pointer flex flex-col items-center gap-1.5 rounded-[0.5rem] border px-2 py-2 text-xs text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  active ? "border-primary bg-primary-soft" : "border-line hover:border-primary/50"
                )}
              >
                <span
                  className="block h-7 w-10 border-2 border-ink-soft/60 bg-paper-raised"
                  style={{ borderRadius: option.radius }}
                  aria-hidden
                />
                {ui.radiusName(option.value)}
              </button>
            );
          })}
        </div>
      </section>

      <ImageField
        label={ui.logo}
        hint={ui.logoHint}
        value={look.logoUrl ?? ""}
        onChange={(url) => onChange({ ...look, logoUrl: url || null })}
      />
    </div>
  );
}

/**
 * ColorField hands back raw keystrokes; only a complete hex reaches the look
 * (and the preview). The half-typed text is kept here until then.
 */
function LookColor({
  label,
  hint,
  value,
  fallback,
  onChange,
}: {
  label: string;
  hint: string;
  value: string | null;
  fallback: string;
  onChange: (hex: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <ColorField
      label={label}
      hint={hint}
      value={draft ?? value ?? fallback}
      onChange={(raw) => {
        const hex = normalizeHex(raw);
        if (hex && raw.replace(/^#/, "").length === 6) {
          setDraft(null);
          onChange(hex);
        } else {
          setDraft(raw);
        }
      }}
    />
  );
}
