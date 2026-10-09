import { useEffect, useRef, useState } from "react";
import { IconCheck, IconCopy } from "@/components/icons";
import { cn } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { copyLink: "Copy link", copied: "Copied" },
  ar: { copyLink: "انسخ اللينك", copied: "اتنسخ" },
} satisfies Messages;

/**
 * Copies `value`, and says so for a moment afterwards.
 *
 * The confirmation is the point: the clipboard gives no visible feedback of
 * its own, so without it a merchant has no way to tell a successful copy from
 * a click that did nothing. The copy glyph gives way to a tick that pops in
 * (--ease-pop), and the word changes with it.
 *
 * `iconOnly` draws it as a 28px round icon button for a toolbar chip
 * (components/StoreLinkBar.tsx); a thumb still gets 44px to land on.
 */
export function CopyButton({
  value,
  label,
  className,
  labelClassName,
  iconOnly = false,
}: {
  value: string;
  label?: string;
  className?: string;
  /** Lets a cramped caller hide the text and leave just the icon. The button
   *  keeps its aria-label either way, and the icon still flips to a tick. */
  labelClassName?: string;
  /** A 28px round icon button; the words stay for screen readers. */
  iconOnly?: boolean;
}) {
  const t = useT(STRINGS);
  const shown = label ?? t.copyLink;
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  // The timeout outlives the component if the merchant navigates away mid-flash.
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Denied permission, or an insecure origin — `navigator.clipboard` is
      // undefined outside HTTPS and localhost. Fall back to the old selection
      // trick so the button still works wherever the dashboard is served.
      const field = document.createElement("textarea");
      field.value = value;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand("copy");
      } catch {
        return;
      } finally {
        field.remove();
      }
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={shown}
      title={shown}
      data-slot="copy-button"
      data-copied={copied ? "" : undefined}
      className={cn(
        "inline-flex cursor-pointer items-center rounded-full font-medium text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
        iconOnly
          ? // The disc is 28px; the invisible ring around it brings a thumb's target to 44px.
            "relative size-7 shrink-0 justify-center pointer-coarse:before:absolute pointer-coarse:before:-inset-2 pointer-coarse:before:content-['']"
          : "min-h-9 gap-1.5 px-2 py-1 text-xs pointer-coarse:min-h-11",
        className
      )}
    >
      {/* Both glyphs share one cell: the copy sign shrinks away as the tick pops in. */}
      <span className="grid size-4 shrink-0 place-items-center" aria-hidden>
        <IconCopy
          className={cn(
            "col-start-1 row-start-1 size-4 transition-[scale,opacity] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
            copied && "scale-50 opacity-0"
          )}
        />
        <IconCheck
          weight="bold"
          className={cn(
            "col-start-1 row-start-1 size-4 text-success transition-[scale,opacity] motion-reduce:transition-none",
            // The overshoot belongs to the way in; on the way out it only fades.
            copied
              ? "scale-100 opacity-100 duration-[var(--dur-pop)] ease-[var(--ease-pop)]"
              : "scale-0 opacity-0 duration-[var(--dur-fade)] ease-[var(--ease-out)]"
          )}
        />
      </span>
      {/* Announced rather than only drawn, so the confirmation isn't visual-only. */}
      <span aria-live="polite" className={iconOnly ? "sr-only" : labelClassName}>
        {copied ? t.copied : shown}
      </span>
    </button>
  );
}
