"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import { Alert } from "./alert";
import { Button } from "./button";
import { Spinner } from "./spinner";

export function defaultErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return "Something went wrong. Please try again.";
}

export interface DataStateLabels {
  loading: string;
  permission: string;
  retry: string;
  empty: string;
}

export interface DataStateProps {
  loading: boolean;
  error: unknown;
  /** True when there's nothing to show and no error. */
  empty?: boolean;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  /** Icon shown above the empty message. */
  emptyIcon?: ReactNode;
  onRetry?: () => void;
  children: ReactNode;
  labels?: Partial<DataStateLabels>;
  /** Turns an error into user-facing text. */
  getErrorMessage?: (err: unknown) => string;
  /** Permission (403) errors get their own copy and no retry button. */
  isPermissionError?: (err: unknown) => boolean;
}

/** Standard loading / error / empty wrapper for a data region. */
export function DataState({
  loading,
  error,
  empty,
  emptyMessage,
  emptyAction,
  emptyIcon,
  onRetry,
  children,
  labels,
  getErrorMessage = defaultErrorMessage,
  isPermissionError = () => false,
}: DataStateProps) {
  const l = {
    loading: "Loading…",
    permission: "You don't have permission to view this.",
    retry: "Try again",
    empty: "Nothing here yet.",
    ...labels,
  };

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-primary" role="status" aria-live="polite">
        <Spinner className="size-6" />
        <span className="sr-only">{l.loading}</span>
      </div>
    );
  }

  if (error) {
    const permission = isPermissionError(error);
    return (
      <Alert variant="danger" className="flex flex-col gap-3">
        <span>{permission ? l.permission : getErrorMessage(error)}</span>
        {onRetry && !permission && (
          <div>
            <Button size="sm" variant="outline" onClick={onRetry}>
              {l.retry}
            </Button>
          </div>
        )}
      </Alert>
    );
  }

  if (empty) {
    return <EmptyBlock message={emptyMessage ?? l.empty} action={emptyAction} icon={emptyIcon} />;
  }

  return <>{children}</>;
}

export function EmptyBlock({
  message,
  action,
  icon,
  className,
}: {
  message: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-paper-raised px-6 py-12 text-center text-sm text-ink-soft",
        className
      )}
    >
      {icon}
      <p>{message}</p>
      {action}
    </div>
  );
}
