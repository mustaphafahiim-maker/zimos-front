import type { ReactNode } from "react";
import { Button, Spinner } from "@store-builder/ui";
import { CloudOff, Lock } from "lucide-react";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    empty: "Nothing here yet.",
    loading: "Loading…",
    permissionTitle: "This page isn't part of your role",
    permission: "Ask the store owner to give you access from Settings → Team.",
    errorTitle: "We couldn't load this",
    retry: "Try again",
  },
  ar: {
    empty: "لسه مفيش حاجة هنا.",
    loading: "بيحمّل…",
    permissionTitle: "الصفحة دي مش ضمن صلاحياتك",
    permission: "اطلب من صاحب المتجر يفتحهالك من الإعدادات ← الفريق.",
    errorTitle: "معرفناش نحمّل الصفحة دي",
    retry: "جرّب تاني",
  },
} satisfies Messages;

interface DataStateProps {
  loading: boolean;
  error: unknown;
  /** True when there's nothing to show and no error. */
  empty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  children: ReactNode;
}

/**
 * Standard loading / error / empty wrapper for a data region. Uses the shared
 * Spinner + Alert; permission (403) errors get their own copy.
 */
export function DataState({
  loading,
  error,
  empty,
  emptyMessage,
  onRetry,
  children,
}: DataStateProps) {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-[30vh] items-center justify-center text-ink-soft"
      >
        <Spinner className="size-6" role="presentation" aria-hidden="true" aria-label={undefined} />
        <span className="sr-only">{t.loading}</span>
      </div>
    );
  }

  if (error) {
    const permission = isPermissionError(error);
    const Icon = permission ? Lock : CloudOff;
    return (
      <div
        role="alert"
        className="flex flex-col items-center rounded-[var(--radius-card)] bg-paper-raised px-6 py-10 text-center shadow-[var(--shadow-card)] ring-1 ring-line"
      >
        <span
          className={
            permission
              ? "mb-3 flex size-11 items-center justify-center rounded-2xl bg-paper-sunken text-ink-soft"
              : "mb-3 flex size-11 items-center justify-center rounded-2xl bg-danger-soft text-danger"
          }
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <p className="text-[15px] font-semibold text-ink">{permission ? t.permissionTitle : t.errorTitle}</p>
        <p className="mt-1 max-w-md text-sm text-ink-soft">{permission ? t.permission : errorMessage(error)}</p>
        {onRetry && !permission && (
          <Button variant="outline" onClick={onRetry} className="mt-4 min-h-11">
            {t.retry}
          </Button>
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong/40 bg-paper-raised/60 px-6 py-12 text-center text-sm text-ink-soft">
        {emptyMessage ?? t.empty}
      </div>
    );
  }

  return <>{children}</>;
}
