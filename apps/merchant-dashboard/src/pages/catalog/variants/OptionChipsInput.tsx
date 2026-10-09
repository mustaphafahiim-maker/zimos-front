import { useId, useRef, useState } from "react";
import { Label, cn } from "@store-builder/ui";
import { IconClose, IconPlus } from "@/components/icons";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { optionLine, optionPairs, readOptionPair } from "./optionValues";

const STRINGS = {
  en: {
    placeholder: "Size: M",
    placeholderMore: "Add another, like Color: Red",
    hint: "Type the option and its value, like “Size: M”, then press Enter. Options can't be changed after the variant is added.",
    needPair: "Write it as the option, a colon, then the value — like “Size: M”.",
    remove: "Remove {pair}",
    suggestSize: "Size",
    suggestColor: "Color",
    chosen: "Options added",
  },
  ar: {
    placeholder: "المقاس: M",
    placeholderMore: "ضيف كمان، زي اللون: أحمر",
    hint: "اكتب الخيار وقيمته، زي «المقاس: M»، ودوس Enter. الخيارات مش بتتعدّل بعد ما المتغير يتضاف.",
    needPair: "اكتبها كده: الخيار، نقطتين، وبعدين القيمة — زي «المقاس: M».",
    remove: "شيل {pair}",
    suggestSize: "المقاس",
    suggestColor: "اللون",
    chosen: "الخيارات اللي اتضافت",
  },
} satisfies Messages;

export interface OptionChipsInputProps {
  /** The options as the one line the form has always held: "Size=M, Color=Red". */
  value: string;
  onChange: (line: string) => void;
  label: string;
  /** The server's complaint about the options, if any. */
  error?: string;
  disabled?: boolean;
}

/**
 * A variant's options as chips. The merchant types a pair — «المقاس: M» — and
 * Enter (or a comma) turns it into a chip; ✕ on a chip takes it off. A whole
 * line pasted in ("Size=M, Color=Red") becomes its chips at once.
 *
 * Options are still free text: nothing here invents a list of sizes or a
 * generator of variants. The value handed back is the same "Name=Value, …"
 * line the old text field held, so the form parses and sends it exactly as
 * before. Typing a name again replaces its value, as the parsed object would.
 */
export function OptionChipsInput({ value, onChange, label, error, disabled = false }: OptionChipsInputProps) {
  const t = useT(STRINGS);
  const inputId = useId();
  const noteId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const pairs = optionPairs(value);

  /** Turn what is typed into chips; what is not a pair yet stays in the field, with a word on how to write it. */
  function commit(raw: string) {
    const parts = raw
      .split(/[,،]/)
      .map((part) => part.trim())
      .filter(Boolean);
    const next = [...pairs];
    const left: string[] = [];
    let changed = false;
    for (const part of parts) {
      const pair = readOptionPair(part);
      if (!pair) {
        left.push(part);
        continue;
      }
      const at = next.findIndex(([name]) => name === pair[0]);
      if (at >= 0) next[at] = pair;
      else next.push(pair);
      changed = true;
    }
    if (changed) onChange(optionLine(next));
    setDraft(left.join("، "));
    setProblem(left.length > 0 ? t.needPair : null);
  }

  function removeAt(index: number) {
    onChange(optionLine(pairs.filter((_, i) => i !== index)));
    inputRef.current?.focus();
  }

  function suggest(name: string) {
    setDraft(`${name}: `);
    setProblem(null);
    inputRef.current?.focus();
  }

  const suggestions = [t.suggestSize, t.suggestColor].filter((name) => !pairs.some(([used]) => used === name));
  const note = problem ?? error;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <div
        data-slot="option-chips"
        // A press on the well's own air lands in the field, like any text box.
        onClick={(event) => {
          if (event.target === event.currentTarget) inputRef.current?.focus();
        }}
        className={cn(
          "zimos-option-well flex min-h-12 cursor-text flex-wrap items-center gap-2 rounded-[0.875rem] border border-line-strong bg-paper-raised p-1.5",
          "transition-[border-color,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/25 motion-reduce:transition-none",
          note && "border-danger focus-within:border-danger focus-within:ring-danger/25"
        )}
      >
        {pairs.length > 0 && (
          <ul role="list" aria-label={t.chosen} className="contents">
            {pairs.map(([name, optionValue], index) => {
              const pair = `${name}: ${optionValue}`;
              return (
                <li
                  key={name}
                  className="zimos-option-chip inline-flex h-9 max-w-full items-center gap-0.5 rounded-full bg-primary-soft ps-3 pe-1 text-sm font-medium text-primary-dark dark:text-primary"
                >
                  <bdi className="min-w-0 truncate">{pair}</bdi>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => removeAt(index)}
                    aria-label={fmt(t.remove, { pair })}
                    className="relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] before:absolute before:-inset-2 before:content-[''] hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-primary motion-safe:active:scale-[0.97] motion-reduce:transition-none"
                  >
                    <IconClose className="size-3.5" weight="bold" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <input
          ref={inputRef}
          id={inputId}
          value={draft}
          disabled={disabled}
          dir="auto"
          autoComplete="off"
          enterKeyHint="done"
          placeholder={pairs.length === 0 ? t.placeholder : t.placeholderMore}
          aria-invalid={note ? true : undefined}
          aria-describedby={noteId}
          onChange={(event) => {
            const text = event.target.value;
            // A comma ends a pair, as it did in the old one-line field.
            if (/[,،]/.test(text)) commit(text);
            else {
              setDraft(text);
              if (problem) setProblem(null);
            }
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter" && draft.trim() !== "") {
              // Enter makes the chip; with nothing typed it is the form's Enter again.
              event.preventDefault();
              commit(draft);
            } else if (event.key === "Backspace" && draft === "" && pairs.length > 0) {
              removeAt(pairs.length - 1);
            }
          }}
          // Pressing «ضيف المتغير» with a pair still in the field must not lose it.
          onBlur={() => {
            if (draft.trim() !== "") commit(draft);
          }}
          className="h-9 min-w-36 flex-1 bg-transparent px-1.5 text-base text-ink outline-none placeholder:text-ink-soft/70 md:text-sm"
        />
      </div>

      {suggestions.length > 0 && !disabled && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => suggest(name)}
              className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-full bg-paper-sunken px-3 text-sm font-medium text-ink-soft ring-1 ring-line transition-[scale,color,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:active:scale-[0.97] pointer-coarse:h-11 motion-reduce:transition-none"
            >
              <IconPlus className="size-3.5" weight="bold" aria-hidden />
              {name}
            </button>
          ))}
        </div>
      )}

      <p id={noteId} role={note ? "alert" : undefined} className={cn("text-xs leading-5", note ? "font-medium text-danger" : "text-ink-soft")}>
        {note ?? t.hint}
      </p>
    </div>
  );
}
