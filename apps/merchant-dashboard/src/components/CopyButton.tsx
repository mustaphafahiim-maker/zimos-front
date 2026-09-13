import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@store-builder/ui";

/**
 * Copies `value`, and says so for a moment afterwards.
 *
 * The confirmation is the point: the clipboard gives no visible feedback of
 * its own, so without it a merchant has no way to tell a successful copy from
 * a click that did nothing.
 */
export function CopyButton({
  value,
  label = "Copy link",
  className,
  labelClassName,
}: {
  value: string;
  label?: string;
  className?: string;
  /** Lets a cramped caller hide the text and leave just the icon. The button
   *  keeps its aria-label either way, and the icon still flips to a tick. */
  labelClassName?: string;
}) {
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
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-[0.5rem] px-2 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-paper hover:text-ink",
        className
      )}
    >
      {copied ? (
        <Check className="size-3.5 text-success" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
      {/* Announced rather than only drawn, so the confirmation isn't visual-only. */}
      <span aria-live="polite" className={labelClassName}>
        {copied ? "Copied" : label}
      </span>
    </button>
  );
}
