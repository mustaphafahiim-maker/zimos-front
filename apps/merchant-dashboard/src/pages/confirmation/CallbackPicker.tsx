import { useId } from "react";
import { cn } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    label: "Call back at",
    hint: "Optional. Without it: in 24 hours (postponed) or 4 hours (no answer).",
    in1h: "In 1 hour",
    tonight: "Tonight 8 pm",
    tomorrow10: "Tomorrow 10 am",
    tomorrow17: "Tomorrow 5 pm",
    custom: "Another time",
    clear: "No time",
  },
  ar: {
    label: "نكلّمه تاني إمتى؟",
    hint: "اختياري. من غيره: بعد ٢٤ ساعة (أجّل) أو ٤ ساعات (مردّش).",
    in1h: "بعد ساعة",
    tonight: "النهارده ٨ بالليل",
    tomorrow10: "بكرة ١٠ الصبح",
    tomorrow17: "بكرة ٥ العصر",
    custom: "معاد تاني",
    clear: "من غير معاد",
  },
} satisfies Messages;

/** A moment `days` from today at `hour`:00 on this device's clock. */
function at(days: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** "2026-10-07T17:00" for <input type="datetime-local">, in local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// The same pill as the chips over a list and in a filter sheet (glass/list.css styles `.zimos-chip` once):
// 40px with a mouse, 44px under a finger; the chosen one takes the brand fill.
const CHIP =
  "zimos-chip inline-flex h-10 cursor-pointer items-center rounded-full px-3.5 text-sm font-medium whitespace-nowrap select-none pointer-coarse:h-11 " +
  "transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100";
const CHIP_ON = "bg-primary text-primary-foreground";
const CHIP_OFF = "bg-paper-raised text-ink ring-1 ring-line hover:bg-paper-sunken";

/**
 * «كلّمني بكرة الساعة ٥»: when to call a postponed / unanswered customer
 * again. Quick chips for the usual answers plus any date and time. The value
 * is a UTC ISO string, or "" for the default delay.
 */
export function CallbackPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
}) {
  const t = useT(STRINGS);
  const id = useId();
  const now = Date.now();
  const tonight = at(0, 20);
  const chips: Array<{ key: string; label: string; when: Date | null }> = [
    { key: "1h", label: t.in1h, when: new Date(now + 60 * 60 * 1000) },
    // "Tonight" only while it is still ahead.
    { key: "tonight", label: t.tonight, when: tonight.getTime() > now + 15 * 60 * 1000 ? tonight : null },
    { key: "t10", label: t.tomorrow10, when: at(1, 10) },
    { key: "t17", label: t.tomorrow17, when: at(1, 17) },
  ];
  // Chip identity by minute, so a re-render's "now" doesn't unpick "in 1 hour".
  const minute = (iso: string) => iso.slice(0, 16);

  return (
    <fieldset className="min-w-0 space-y-2.5" disabled={disabled}>
      <legend className="text-sm font-medium text-ink">{t.label}</legend>
      <div className="flex flex-wrap gap-2">
        {chips
          .filter((c) => c.when)
          .map((c) => {
            const iso = (c.when as Date).toISOString();
            const picked = value !== "" && minute(value) === minute(iso);
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={picked}
                onClick={() => onChange(picked ? "" : iso)}
                className={cn(CHIP, picked ? CHIP_ON : CHIP_OFF)}
              >
                {c.label}
              </button>
            );
          })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="text-sm text-ink-soft">
          {t.custom}
        </label>
        <input
          id={id}
          type="datetime-local"
          value={value ? toLocalInput(value) : ""}
          min={toLocalInput(new Date(now + 5 * 60 * 1000).toISOString())}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : "")}
          className="h-10 min-w-0 rounded-[0.875rem] border border-line-strong bg-paper-raised px-3 text-sm text-ink focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 pointer-coarse:h-11"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="min-h-10 cursor-pointer rounded-full px-2.5 text-sm text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-primary pointer-coarse:min-h-11"
          >
            {t.clear}
          </button>
        )}
      </div>
      <p className="text-xs leading-5 text-ink-soft">{t.hint}</p>
    </fieldset>
  );
}
