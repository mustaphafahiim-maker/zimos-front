"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "cn";

export type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ToastContextValue {
  notify: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export interface ToastProviderProps {
  children: ReactNode;
  /** Where the stack renders. Default: bottom inline-end. */
  position?: "bottom-end" | "top-center";
  /** Accessible label for the dismiss button. */
  dismissLabel?: string;
}

export function ToastProvider({ children, position = "bottom-end", dismissLabel = "Dismiss" }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const notify = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      notify,
      success: (m) => notify("success", m),
      error: (m) => notify("error", m),
      info: (m) => notify("info", m),
    }),
    [notify]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className={cn(
          "pointer-events-none fixed z-[60] flex flex-col gap-2",
          position === "bottom-end"
            ? "inset-x-4 bottom-4 items-end pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:end-4 sm:w-96"
            : "inset-x-0 top-4 items-center px-4"
        )}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            className={cn(
              "animate-zimos-slide-up pointer-events-auto flex w-full items-start gap-2.5 rounded-2xl border bg-paper-raised px-4 py-3 text-sm text-ink shadow-[var(--shadow-pop)]",
              position === "top-center" && "max-w-md",
              toast.kind === "success" && "border-success/30",
              toast.kind === "error" && "border-danger/30",
              toast.kind === "info" && "border-primary/20"
            )}
          >
            {toast.kind === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            ) : toast.kind === "error" ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            )}
            <span className="min-w-0 flex-1 text-start">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={dismissLabel}
              className="-me-1 cursor-pointer rounded-md p-0.5 text-ink-muted transition-colors hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
