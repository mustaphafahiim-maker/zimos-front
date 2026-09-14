import { useCallback, useState, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { useToast } from "@/components/Toast";
import { getErrorMessage } from "@/lib/errors";

/** Row with a label/description at the start and a control at the end. */
export function SettingRow({ label, description, children, className }: { label: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 border-b border-line py-3.5 last:border-0 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {description && <p className="mt-0.5 text-xs text-ink-soft">{description}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Wraps a mutation with busy state and toast feedback. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, success?: string | ((r: T) => string)): Promise<T | undefined> => {
      setBusy(key);
      try {
        const r = await fn();
        if (success) toast.success(typeof success === "function" ? success(r) : success);
        return r;
      } catch (err) {
        toast.error(getErrorMessage(err));
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [toast]
  );
  return { busy, run };
}

export function Checklist<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
  disabled,
}: {
  options: Array<{ value: T; label: string; hint?: string }>;
  value: T[];
  onChange: (next: T[]) => void;
  columns?: 1 | 2 | 3 | 4;
  disabled?: boolean;
}) {
  const cols = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns];
  return (
    <div className={cn("grid grid-cols-1 gap-1.5", cols)}>
      {options.map((o) => {
        const checked = value.includes(o.value);
        return (
          <label key={o.value} className={cn("flex cursor-pointer items-start gap-2 rounded-[8px] px-2 py-1.5 text-sm hover:bg-primary-soft/60", disabled && "cursor-not-allowed opacity-60")}>
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--color-primary)]"
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(checked ? value.filter((v) => v !== o.value) : [...value, o.value])}
            />
            <span className="min-w-0">
              <span className="block text-ink">{o.label}</span>
              {o.hint && <span className="block text-xs text-ink-soft">{o.hint}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Downloads rows as a CSV file in the browser. */
export function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number | null>>) {
  const esc = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>
  );
}

/** Minimal, safe markdown preview (headings, bold, bullet lists, paragraphs). */
export function MarkdownPreview({ source, dir }: { source: string; dir?: "rtl" | "ltr" }) {
  const blocks = source.split(/\n{2,}/);
  return (
    <div dir={dir} className="space-y-3 text-sm leading-relaxed text-ink">
      {blocks.map((b, i) => {
        const t = b.trim();
        if (!t) return null;
        if (t.startsWith("## ")) return <h3 key={i} className="text-base font-semibold">{inline(t.slice(3))}</h3>;
        if (t.startsWith("# ")) return <h2 key={i} className="text-lg font-semibold">{inline(t.slice(2))}</h2>;
        const lines = t.split("\n");
        if (lines.every((l) => /^[-*] /.test(l.trim())))
          return (
            <ul key={i} className="list-disc space-y-1 ps-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.trim().slice(2))}</li>
              ))}
            </ul>
          );
        return (
          <p key={i} className="whitespace-pre-line">
            {inline(t)}
          </p>
        );
      })}
    </div>
  );
}

/** Replace {{var}} placeholders with sample values. */
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);
}
