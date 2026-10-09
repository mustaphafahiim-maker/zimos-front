import type { ReactNode } from "react";
import { Button, cn } from "@store-builder/ui";
import { IconContext, IconLock, IconOffline, IconRefresh, IconWarning } from "@/components/icons";
import { ApiError, isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { PlanFeatureNotice, planFeatureRequired } from "@/pages/settings/billing/PlanFeatureNotice";

const STRINGS = {
  en: {
    empty: "Nothing here yet.",
    loading: "Loading…",
    permissionTitle: "This page isn't part of your role",
    permission: "Ask the store owner to give you access from Settings → Team.",
    errorTitle: "We couldn't load this",
    offlineTitle: "The connection dropped",
    retry: "Try again",
  },
  ar: {
    empty: "لسه مفيش حاجة هنا.",
    loading: "بيحمّل…",
    permissionTitle: "الصفحة دي مش ضمن صلاحياتك",
    permission: "اطلب من صاحب المتجر يفتحهالك من الإعدادات ← الفريق.",
    errorTitle: "معرفناش نحمّل الصفحة دي",
    offlineTitle: "الاتصال اتقطع",
    retry: "جرّب تاني",
  },
} satisfies Messages;

type SkeletonShape = "card" | "table" | "tiles";

interface DataStateProps {
  loading: boolean;
  error: unknown;
  /** True when there's nothing to show and no error. */
  empty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  /**
   * What stands in for the content while it loads: a card of text lines (the
   * default), a table, a row of KPI tiles, or the page's own placeholder.
   */
  skeleton?: SkeletonShape | ReactNode;
  children: ReactNode;
}

/**
 * One line of a skeleton. Height and width come from the caller (h-3 by default).
 *
 * On its own it is a grey bar that breathes. Under the glass layer
 * (glass/states.css, `.zimos-skeleton`) the breathing gives way to a band of
 * light that sweeps along the bar in the reading direction — transform only,
 * and still for anyone who asked for less motion.
 */
export function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "zimos-skeleton relative h-3 animate-pulse overflow-hidden rounded-full bg-paper-sunken motion-reduce:animate-none",
        className
      )}
    />
  );
}

const SKELETON_CARD = "rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line";

// Line widths, in order, so a long card doesn't end in a block of equal lines.
const CARD_LINES = ["w-11/12", "w-4/5", "w-3/5", "w-5/6", "w-2/3", "w-3/4", "w-1/2"] as const;

/** A title line and a few lines of text (three by default) — what most pages become. */
export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div data-slot="skeleton-card" className={cn(SKELETON_CARD, className)}>
      <SkeletonBar className="h-4 w-2/5" />
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBar key={i} className={cn(i === 0 ? "mt-4" : "mt-3", CARD_LINES[i % CARD_LINES.length])} />
      ))}
    </div>
  );
}

// Widths per row so the "cells" don't line up in a block (first, second, end-aligned third).
const TABLE_ROWS: ReadonlyArray<readonly [string, string, string]> = [
  ["w-2/5", "w-1/4", "w-14"],
  ["w-1/3", "w-1/5", "w-12"],
  ["w-1/2", "w-1/4", "w-16"],
  ["w-1/3", "w-1/6", "w-14"],
  ["w-2/5", "w-1/5", "w-12"],
];

/** A header line and five rows, for a page whose body is a list. */
export function TableSkeleton() {
  return (
    <div data-slot="skeleton-card" className={SKELETON_CARD}>
      <div className="flex items-center gap-4 border-b border-line pb-3">
        <SkeletonBar className="h-2.5 w-1/4" />
        <SkeletonBar className="h-2.5 w-1/5" />
        <SkeletonBar className="ms-auto h-2.5 w-1/6" />
      </div>
      {TABLE_ROWS.map(([first, second, last], i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line py-3.5 last:border-0 last:pb-0">
          <SkeletonBar className={first} />
          <SkeletonBar className={second} />
          <SkeletonBar className={cn("ms-auto", last)} />
        </div>
      ))}
    </div>
  );
}

/** Four KPI-shaped tiles: a label line over a figure. */
export function TilesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-[var(--bento-gap)] lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} data-slot="skeleton-card" className={cn(SKELETON_CARD, "h-28")}>
          <SkeletonBar className="h-2.5 w-1/2" />
          <SkeletonBar className="mt-5 h-6 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/**
 * A whole page while its code is on the way (routes/LazyRoute.tsx): a title
 * line and a description line where PageHeader sits — the same heights and the
 * same gap below, so nothing jumps when the page arrives — then a row of four
 * tiles and a card of lines.
 */
export function PageSkeleton() {
  return (
    <div>
      <div className="mb-6">
        {/* The h1's line box (2.25rem inside the dashboard), then the description's. */}
        <div className="flex h-9 items-center">
          <SkeletonBar className="h-6 w-44" />
        </div>
        <div className="mt-1 flex h-5 items-center">
          <SkeletonBar className="w-72 max-w-[70%]" />
        </div>
      </div>
      <TilesSkeleton />
      <CardSkeleton lines={6} className="mt-[var(--bento-gap)]" />
    </div>
  );
}

// Every icon in a state message is drawn in two tones, whatever the caller passed.
const DUOTONE = { weight: "duotone" } as const;

const STATE_INK = {
  danger: "text-danger",
  attention: "text-accent-dark",
  neutral: "text-ink-soft",
} as const;

interface StateMessageProps {
  /** A 40px icon in two tones; its colour follows `tone`. */
  icon: ReactNode;
  /** What happened, in a few words. */
  title: string;
  /** Why, or what to do about it. */
  description?: string;
  /** The one way out (a 44px pill). Leave it out when there is none. */
  action?: ReactNode;
  tone?: keyof typeof STATE_INK;
  role?: "alert" | "status";
  className?: string;
}

/**
 * The pane a data region or a page becomes when it has something to say
 * instead of content: could not load, not allowed, crashed. One look for all
 * of them — the icon, what happened, the reason in words, the way out.
 * The glass fill, the rim and the glow behind the icon are in glass/states.css.
 */
export function StateMessage({ icon, title, description, action, tone = "neutral", role, className }: StateMessageProps) {
  return (
    <div
      role={role}
      data-slot="data-state"
      className={cn(
        "flex flex-col items-center rounded-[var(--radius-card)] bg-paper-raised px-6 py-10 text-center shadow-[var(--shadow-card)] ring-1 ring-line",
        className
      )}
    >
      <span
        data-slot="state-icon"
        data-tone={tone}
        className={cn("relative isolate mb-4 flex size-10 shrink-0 items-center justify-center [&_svg]:size-10", STATE_INK[tone])}
      >
        <IconContext.Provider value={DUOTONE}>{icon}</IconContext.Provider>
      </span>
      <p className="text-base font-semibold text-ink">{title}</p>
      {description && (
        <p data-slot="state-description" className="mt-1.5 max-w-md text-sm leading-6 text-ink-soft">
          {description}
        </p>
      )}
      {action && <div className="mt-5 [&_a]:min-h-11 [&_button]:min-h-11">{action}</div>}
    </div>
  );
}

/** The same test lib/errorMessages.ts makes before it says "can't reach the server". */
function isNetworkError(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 0 || err.message === "Failed to fetch";
  return err instanceof TypeError && /fetch/i.test(err.message);
}

/**
 * Standard loading / error / empty wrapper for a data region. Loading shows a
 * skeleton in the shape of the content (never a spinner); permission (403)
 * errors get their own copy and no retry — trying again cannot grant a role.
 */
export function DataState({
  loading,
  error,
  empty,
  emptyMessage,
  onRetry,
  skeleton = "card",
  children,
}: DataStateProps) {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();

  if (loading) {
    return (
      <div role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">{t.loading}</span>
        <div aria-hidden>
          {skeleton === "table" ? (
            <TableSkeleton />
          ) : skeleton === "tiles" ? (
            <TilesSkeleton />
          ) : skeleton === "card" ? (
            <CardSkeleton />
          ) : (
            skeleton
          )}
        </div>
      </div>
    );
  }

  if (error) {
    // A 403 from the plan gate is not a missing role: it names the feature and leads to the plans.
    const gated = planFeatureRequired(error);
    if (gated) return <PlanFeatureNotice feature={gated} />;
    if (isPermissionError(error)) {
      return (
        <StateMessage
          role="alert"
          icon={<IconLock aria-hidden />}
          title={t.permissionTitle}
          description={t.permission}
        />
      );
    }
    const offline = isNetworkError(error);
    return (
      <StateMessage
        role="alert"
        tone="danger"
        // A cut connection and a failure on our side are different things to look at.
        icon={offline ? <IconOffline aria-hidden /> : <IconWarning aria-hidden />}
        title={offline ? t.offlineTitle : t.errorTitle}
        description={errorMessage(error)}
        action={
          onRetry && (
            <Button variant="outline" onClick={onRetry} className="min-h-11 rounded-full px-5">
              <IconRefresh weight="bold" className="size-4" aria-hidden />
              {t.retry}
            </Button>
          )
        }
      />
    );
  }

  if (empty) {
    return (
      <div
        data-slot="data-empty"
        className="rounded-[1.5rem] border border-dashed border-line-strong/40 bg-paper-raised/60 px-6 py-12 text-center text-sm leading-6 text-ink-soft"
      >
        {emptyMessage ?? t.empty}
      </div>
    );
  }

  return <>{children}</>;
}
