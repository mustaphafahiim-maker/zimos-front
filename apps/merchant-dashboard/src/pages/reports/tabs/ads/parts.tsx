import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { SkeletonBar } from "@/components/DataState";
import { IconRefresh, IconWarning } from "@/components/icons";
import { useCommon, useT } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { isPermissionError } from "@/lib/errors";
import { ADS_STRINGS } from "./adsStrings";

/**
 * One part of the tab that failed to load, on its own line: what failed and
 * «جرّب تاني». The rest of the tab stays as it is — a side request never
 * blanks the page.
 */
export function PartError({ message, onRetry, className }: { message: string; onRetry: () => void; className?: string }) {
  const common = useCommon();
  return (
    <div
      role="alert"
      data-slot="report-part-error"
      className={cn(
        "flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[1.25rem] bg-danger-soft py-1 ps-4 pe-1.5 text-sm leading-6 text-ink ring-1 ring-danger/20",
        className
      )}
    >
      <span className="flex min-w-0 items-center gap-2 py-1.5">
        <IconWarning weight="fill" className="size-4 shrink-0 text-danger" aria-hidden />
        <span className="min-w-0">{message}</span>
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 font-semibold text-primary transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-raised focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <IconRefresh weight="bold" className="size-4" aria-hidden />
        {common.retry}
      </button>
    </div>
  );
}

/** The sentence's strip while the figures it is worked out from are still on their way. */
export function TakeawayBones() {
  const t = useT(ADS_STRINGS);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-[3.25rem] min-w-0 items-center gap-3 rounded-(--radius-card) bg-paper-sunken px-4 py-3.5 ring-1 ring-line"
    >
      <span className="sr-only">{t.loadingPart}</span>
      <SkeletonBar className="size-5 shrink-0" />
      <SkeletonBar className="w-3/5" />
    </div>
  );
}

/** A section of «تفاصيل أكتر» while its own request is on its way. */
export function SectionBones({ flush = false }: { flush?: boolean }) {
  const t = useT(ADS_STRINGS);
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={cn("flex flex-col gap-3", flush && "px-4 py-4")}>
      <span className="sr-only">{t.loadingPart}</span>
      <SkeletonBar className="w-2/3" />
      <SkeletonBar className="w-1/2" />
      <SkeletonBar className="w-3/5" />
    </div>
  );
}

/** What `useTabData` gives a section: its answer, or why there is none. */
export interface SectionQuery<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
  retry: () => void;
}

/**
 * The gate of a section that loads its own data when opened: bones while it
 * loads, a quiet line when the role may not read it (a 403 is not an error),
 * an error line with retry for anything else, then the section itself.
 * `flush`: the section has no padding of its own (it holds a table edge to edge).
 */
export function SectionLoad<T>({
  query,
  flush = false,
  children,
}: {
  query: SectionQuery<T>;
  flush?: boolean;
  children: (data: T) => ReactNode;
}) {
  const t = useT(ADS_STRINGS);
  if (query.loading) return <SectionBones flush={flush} />;
  if (query.error) {
    if (isPermissionError(query.error)) {
      return <p className={cn("text-sm leading-6 text-ink-soft", flush && "px-4 py-4")}>{t.partDenied}</p>;
    }
    return (
      <div className={cn(flush && "p-3")}>
        <PartError message={t.partError} onRetry={query.retry} />
      </div>
    );
  }
  if (query.data === null) return null;
  return <>{children(query.data)}</>;
}

/** The small count at the end of a closed section's row. */
export function CountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-paper-sunken px-2 text-xs font-semibold text-ink-soft tabular-nums">
      <bdi dir="ltr">{formatCount(count)}</bdi>
    </span>
  );
}
