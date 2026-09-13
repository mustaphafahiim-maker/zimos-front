import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@store-builder/ui";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  notify: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
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
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <button
            type="button"
            key={toast.id}
            onClick={() => dismiss(toast.id)}
            className={cn(
              "animate-zimos-slide-up pointer-events-auto w-full max-w-md cursor-pointer rounded-[10px] border px-4 py-3 text-start text-sm shadow-[var(--shadow-pop)]",
              toast.kind === "success" && "border-success/30 bg-success-soft text-success",
              toast.kind === "error" && "border-danger/30 bg-danger-soft text-danger",
              toast.kind === "info" && "border-primary/20 bg-paper-raised text-ink"
            )}
            role={toast.kind === "error" ? "alert" : "status"}
          >
            {toast.message}
          </button>
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
