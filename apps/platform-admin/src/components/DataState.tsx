import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Alert, Button, Spinner } from "@store-builder/ui";
import { getErrorMessage, isPermissionError } from "@/lib/errors";

interface DataStateProps {
  loading: boolean;
  error: unknown;
  /** True when there's nothing to show and no error. */
  empty?: boolean;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  onRetry?: () => void;
  children: ReactNode;
}

/**
 * Standard loading / error / empty wrapper for a data region, in the merchant
 * dashboard's shapes (its components/DataState.tsx and EmptyState.tsx): the
 * spinner in the middle of the region, the error as an alert with a way to
 * try again, and "nothing here" as a pane with an icon tile.
 */
export function DataState({
  loading,
  error,
  empty,
  emptyMessage = "Nothing here yet.",
  emptyAction,
  onRetry,
  children,
}: DataStateProps) {
  if (loading) {
    return (
      <div role="status" aria-live="polite" className="flex min-h-[30vh] items-center justify-center text-ink-soft">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error) {
    const permission = isPermissionError(error);
    return (
      <Alert variant="danger" className="flex flex-col gap-3">
        <span>
          {permission
            ? "Your admin role doesn't have permission to view this."
            : getErrorMessage(error)}
        </span>
        {onRetry && !permission && (
          <div>
            <Button size="sm" variant="outline" onClick={onRetry} className="min-h-11">
              Try again
            </Button>
          </div>
        )}
      </Alert>
    );
  }

  if (empty) {
    return <EmptyBlock message={emptyMessage} action={emptyAction} />;
  }

  return <>{children}</>;
}

export function EmptyBlock({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-paper-raised px-6 py-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary [&>svg]:size-6">
        <Inbox aria-hidden />
      </div>
      <p className="max-w-md text-base font-semibold text-ink">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
