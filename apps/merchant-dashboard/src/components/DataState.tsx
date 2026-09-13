import type { ReactNode } from "react";
import { Alert, Button, Spinner } from "@store-builder/ui";
import { getErrorMessage, isPermissionError } from "@/lib/errors";
import { useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    loading: "Loading…",
    permission: "You don't have permission to view this. Ask an owner to update your role.",
    retry: "Try again",
    empty: "Nothing here yet.",
  },
  ar: {
    loading: "جارٍ التحميل…",
    permission: "ليست لديك صلاحية لعرض هذا المحتوى. اطلب من مالك المتجر تحديث دورك.",
    retry: "حاول مرة أخرى",
    empty: "لا يوجد شيء هنا بعد.",
  },
};

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
export function DataState({ loading, error, empty, emptyMessage, onRetry, children }: DataStateProps) {
  const t = useT(STRINGS);

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-primary" role="status" aria-live="polite">
        <Spinner className="size-6" />
        <span className="sr-only">{t.loading}</span>
      </div>
    );
  }

  if (error) {
    const permission = isPermissionError(error);
    return (
      <Alert variant="danger" className="flex flex-col gap-3">
        <span>{permission ? t.permission : getErrorMessage(error)}</span>
        {onRetry && !permission && (
          <div>
            <Button size="sm" variant="outline" onClick={onRetry}>
              {t.retry}
            </Button>
          </div>
        )}
      </Alert>
    );
  }

  if (empty) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong bg-paper-raised px-6 py-12 text-center text-sm text-ink-soft">
        {emptyMessage ?? t.empty}
      </div>
    );
  }

  return <>{children}</>;
}
