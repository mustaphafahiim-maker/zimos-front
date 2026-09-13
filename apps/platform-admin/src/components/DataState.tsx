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

/** Standard loading / error / empty wrapper for a data region. */
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
      <div className="flex min-h-[30vh] items-center justify-center text-ink-soft">
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
            <Button size="sm" variant="outline" onClick={onRetry}>
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
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-paper-raised/60 px-6 py-12 text-center text-sm text-ink-soft">
      <Inbox className="size-6 text-ink-muted" aria-hidden />
      <p>{message}</p>
      {action}
    </div>
  );
}
