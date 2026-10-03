import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@store-builder/ui";

/**
 * An id shown short (its first 8 characters — enough to search by) with a
 * button that copies the whole of it. The full id is in the title and in the
 * button's label, so nothing is hidden from a screen reader.
 */
export function CopyId({ value, full = false, className }: { value: string; full?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <code dir="ltr" title={value} className="font-mono text-xs text-ink-soft">
        {full ? value : `${value.slice(0, 8)}…`}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? `Copied ${value}` : `Copy ID ${value}`}
        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-ink-soft hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      </button>
    </span>
  );
}
