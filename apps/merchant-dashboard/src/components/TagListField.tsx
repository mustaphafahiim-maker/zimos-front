import { useId, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Button, Input } from "@store-builder/ui";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { add: "Add", remove: "Remove {tag}", full: "That's the most you can add." },
  ar: { add: "ضيف", remove: "شيل {tag}", full: "ده أقصى عدد تقدر تضيفه." },
} satisfies Messages;

/**
 * A short list of words typed one by one (tags, UTM values): each shows as a
 * removable chip; Enter or a comma adds what was typed, a pasted "a, b" adds
 * both, Backspace in the empty box removes the last one. Duplicates are
 * ignored, case-insensitively.
 */
export function TagListField({
  label,
  values,
  onChange,
  max,
  maxLength = 100,
  placeholder,
  hint,
  lowercase = false,
  dir,
  disabled,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  max: number;
  maxLength?: number;
  placeholder?: string;
  hint?: string;
  /** Stores every value in lower case (the server lower-cases them anyway). */
  lowercase?: boolean;
  dir?: "ltr" | "rtl" | "auto";
  disabled?: boolean;
}) {
  const t = useT(STRINGS);
  const inputId = useId();
  const hintId = useId();
  const [draft, setDraft] = useState("");
  const full = values.length >= max;

  function add(raw: string) {
    const next = [...values];
    const seen = new Set(values.map((v) => v.toLowerCase()));
    for (const part of raw.split(/[,،]/)) {
      let value = part.trim().slice(0, maxLength);
      if (lowercase) value = value.toLowerCase();
      if (!value || seen.has(value.toLowerCase()) || next.length >= max) continue;
      seen.add(value.toLowerCase());
      next.push(value);
    }
    setDraft("");
    if (next.length !== values.length) onChange(next);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === "،") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <li
              key={value}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/30 bg-primary-soft py-0.5 ps-2.5 pe-1 text-sm text-primary-dark dark:text-primary"
            >
              <bdi dir={dir} className="min-w-0 truncate">
                {value}
              </bdi>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(values.filter((x) => x !== value))}
                aria-label={fmt(t.remove, { tag: value })}
                className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-paper-raised focus-visible:outline-2 focus-visible:outline-primary"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          id={inputId}
          dir={dir}
          value={draft}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled || full}
          aria-describedby={hint || full ? hintId : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && add(draft)}
          className="min-w-0 flex-1"
        />
        <Button type="button" variant="outline" className="shrink-0" disabled={disabled || full || !draft.trim()} onClick={() => add(draft)}>
          {t.add}
        </Button>
      </div>
      {(hint || full) && (
        <p id={hintId} className="text-xs text-ink-soft">
          {full ? t.full : hint}
        </p>
      )}
    </div>
  );
}
