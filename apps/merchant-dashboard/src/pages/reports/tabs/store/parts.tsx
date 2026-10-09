import type { ReactNode } from "react";
import { Button, cn } from "@store-builder/ui";
import { SkeletonBar } from "@/components/DataState";
import { IconCaretDown, IconCaretUp, IconRefresh, IconWarning } from "@/components/icons";
import { useT } from "@/i18n/LocaleContext";
import { isPermissionError } from "@/lib/errors";
import { formatPercentValue } from "@/lib/format";
import { STORE_STRINGS } from "./strings";

/**
 * Small pieces the parts of the "store" tab share: a figure that keeps its own
 * direction inside an Arabic line, the error line of ONE part (with its retry),
 * and the gate of a section that loads its own data when opened.
 */

/** A number, a rate or an amount beside Arabic words: its own run, left to right, digits in columns. */
export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={cn("tabular-nums", className)}>
      {children}
    </bdi>
  );
}

/** One failed part says so on its own line and offers to try again — the rest of the tab stays as it is. */
export function RetryLine({ message, onRetry, className }: { message: string; onRetry: () => void; className?: string }) {
  const t = useT(STORE_STRINGS);
  return (
    <div role="alert" className={cn("flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2", className)}>
      <p className="flex min-w-0 items-start gap-2 text-sm leading-6 text-pretty text-ink">
        <IconWarning weight="fill" className="mt-1 size-4 shrink-0 text-danger" aria-hidden />
        <span className="min-w-0">{message}</span>
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        // The click event must not reach a loader's `refresh` as its options.
        onClick={() => onRetry()}
        className="h-10 rounded-full px-3.5 pointer-coarse:h-11"
      >
        <IconRefresh weight="bold" className="size-4" aria-hidden />
        {t.retry}
      </Button>
    </div>
  );
}

// Line widths, in order, so the placeholder does not end in a block of equal lines.
const BONES = ["w-11/12", "w-3/4", "w-5/6", "w-2/3", "w-4/5", "w-1/2"] as const;

/**
 * The gate of a «تفاصيل أكتر» section that asks for its own data once opened:
 * placeholder lines while it loads; a quiet line when the part is not for this
 * role (a 403 — the section is already open, so it says so instead of
 * vanishing); the part's own error line with a retry for anything else.
 * It pads itself: the sections are `flush`, so a table can run edge to edge.
 * `bare` leaves the padding out, for a part inside a body that is padded already.
 */
export function SectionState({
  loading,
  error,
  onRetry,
  lines = 4,
  bare = false,
  children,
}: {
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  lines?: number;
  bare?: boolean;
  children: ReactNode;
}) {
  const t = useT(STORE_STRINGS);
  if (loading) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className={bare ? undefined : "px-4 py-4"}>
        <span className="sr-only">{t.loading}</span>
        <div aria-hidden className="flex flex-col gap-3">
          {Array.from({ length: Math.max(1, lines) }, (_, index) => (
            <SkeletonBar key={index} className={BONES[index % BONES.length]} />
          ))}
        </div>
      </div>
    );
  }
  if (error) {
    if (isPermissionError(error)) return <p className={cn("text-sm leading-6 text-ink-soft", !bare && "px-4 py-4")}>{t.partDenied}</p>;
    return <RetryLine message={t.partFailed} onRetry={onRetry} className={bare ? undefined : "px-4 py-3"} />;
  }
  return <>{children}</>;
}

/**
 * The change of a figure against the comparison period, small, for a line of
 * text: an arrow for the direction, green or red for what it means, the size
 * in percent. Renders nothing without a baseline.
 */
export function DeltaText({ basisPoints, goodWhen = "up" }: { basisPoints: number | null; goodWhen?: "up" | "down" }) {
  const t = useT(STORE_STRINGS);
  if (basisPoints === null || !Number.isFinite(basisPoints)) return null;
  const rose = basisPoints > 0;
  const fell = basisPoints < 0;
  const good = goodWhen === "down" ? fell : rose;
  const bad = goodWhen === "down" ? rose : fell;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums",
        good ? "text-success" : bad ? "text-danger" : "text-ink-soft"
      )}
    >
      {rose && <IconCaretUp weight="fill" className="size-3 shrink-0" aria-hidden />}
      {fell && <IconCaretDown weight="fill" className="size-3 shrink-0" aria-hidden />}
      {(rose || fell) && <span className="sr-only">{rose ? t.up : t.down}</span>}
      <bdi dir="ltr">{formatPercentValue(Math.abs(basisPoints) / 10000)}</bdi>
    </span>
  );
}

/** A label and its figure on one line, for a strip of small totals inside a section. */
export function MiniStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="flex items-baseline gap-1.5 font-semibold text-ink">{children}</dd>
    </div>
  );
}
