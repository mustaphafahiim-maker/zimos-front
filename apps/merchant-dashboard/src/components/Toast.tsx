import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { cn } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { close: "Close" },
  ar: { close: "إغلاق" },
} satisfies Messages;

/** How long a toast stays: an error is often two sentences of Arabic to read. */
const DURATION_MS: Record<"success" | "error", number> = { success: 4500, error: 10000 };

type ToastKind = "success" | "error";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  notify: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), DURATION_MS[kind]);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      notify,
      success: (m) => notify("success", m),
      error: (m) => notify("error", m),
    }),
    [notify]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** One toast: an icon and the message (never colour alone), and a close button. */
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const t = useT(STRINGS);
  const Icon = toast.kind === "success" ? CheckCircle2 : CircleAlert;
  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-[var(--radius-card)] bg-paper-raised py-3 ps-4 pe-2 text-sm text-ink shadow-[var(--shadow-pop)] ring-1",
        toast.kind === "success" ? "ring-success/30" : "ring-danger/40"
      )}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", toast.kind === "success" ? "text-success" : "text-danger")} aria-hidden />
      <p className="min-w-0 flex-1 leading-6">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t.close}
        className="-my-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft hover:bg-paper-sunken hover:text-ink"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
