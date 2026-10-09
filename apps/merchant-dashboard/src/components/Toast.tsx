import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { IconClose, IconError, IconSuccess, IconUndo } from "@/components/icons";
import { cn } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    close: "Close",
    undo: "Undo",
    undoFailed: "We couldn't undo that, so it stays as you changed it.",
  },
  ar: {
    close: "إغلاق",
    undo: "تراجع",
    undoFailed: "معرفناش نتراجع، فالتعديل لسه زي ما هو.",
  },
} satisfies Messages;

/**
 * How long a toast stays: an error is often two sentences of Arabic to read,
 * and an Undo has to be reached before it goes.
 */
const DURATION_MS = { success: 4500, error: 10000, undo: 7000 } as const;
/** Never more than this many on screen: the oldest leaves to make room. */
const MAX_VISIBLE = 3;
/** The fade out (--dur-fade, 160ms) plus a frame, then the toast is taken out of the page. */
const LEAVE_MS = 180;
/** After the pointer or focus leaves a toast it stays at least this long, so it never vanishes under the hand. */
const RESUME_MIN_MS = 1500;

type ToastKind = "success" | "error";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** One pill button after the message; pressing it also closes the toast. */
  action?: ToastAction;
  /** Milliseconds on screen; the default follows the kind. */
  duration?: number;
}

interface ToastRecord {
  id: number;
  kind: ToastKind | "undo";
  message: string;
  duration: number;
  action?: ToastAction;
  onUndo?: () => void | Promise<void>;
  /** Fading out: still in the page for LEAVE_MS, no longer counted or clickable. */
  leaving: boolean;
}

interface ToastContextValue {
  notify: (kind: ToastKind, message: string, opts?: ToastOptions) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  /**
   * «اتحفظ · تراجع»: says what was done and offers to take it back for a few
   * seconds (also Ctrl/⌘+Z while it shows). If `onUndo` throws or its promise
   * rejects, an error toast says the change is still in place.
   */
  undo: (message: string, onUndo: () => void | Promise<void>, opts?: { duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Ctrl/⌘+Z belongs to the field while someone is typing in one. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useT(STRINGS);
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  // The sentence for a failed undo is needed long after the render that showed the toast.
  const strings = useRef(t);
  useEffect(() => {
    strings.current = t;
  }, [t]);

  const timers = useRef(new Set<number>());
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  /** Fade it out, then take it out of the page (at once for people who asked for less motion). */
  const dismiss = useCallback(
    (id: number) => {
      if (prefersReducedMotion()) {
        remove(id);
        return;
      }
      setToasts((prev) => prev.map((toast) => (toast.id === id && !toast.leaving ? { ...toast, leaving: true } : toast)));
      const timer = window.setTimeout(() => {
        timers.current.delete(timer);
        remove(id);
      }, LEAVE_MS);
      timers.current.add(timer);
    },
    [remove]
  );

  const push = useCallback((toast: Omit<ToastRecord, "id" | "leaving">) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { ...toast, id, leaving: false }]);
  }, []);

  const notify = useCallback(
    (kind: ToastKind, message: string, opts?: ToastOptions) => {
      push({ kind, message, duration: opts?.duration ?? DURATION_MS[kind], action: opts?.action });
    },
    [push]
  );

  const undo = useCallback(
    (message: string, onUndo: () => void | Promise<void>, opts?: { duration?: number }) => {
      push({ kind: "undo", message, duration: opts?.duration ?? DURATION_MS.undo, onUndo });
    },
    [push]
  );

  /** The pill was pressed: the toast goes, then its action runs. */
  const act = useCallback(
    (toast: ToastRecord) => {
      dismiss(toast.id);
      if (toast.kind !== "undo") {
        toast.action?.onClick();
        return;
      }
      const failed = () => push({ kind: "error", message: strings.current.undoFailed, duration: DURATION_MS.error });
      try {
        void Promise.resolve(toast.onUndo?.()).catch(failed);
      } catch {
        failed();
      }
    },
    [dismiss, push]
  );

  // The fourth toast pushes the oldest one out.
  useEffect(() => {
    const live = toasts.filter((toast) => !toast.leaving);
    const oldest = live[0];
    if (oldest && live.length > MAX_VISIBLE) dismiss(oldest.id);
  }, [toasts, dismiss]);

  // Ctrl/⌘+Z takes back the newest thing that still offers Undo — unless a field
  // is being typed in, or the page already used the key for its own undo.
  const latestUndo = toasts.findLast((toast) => toast.kind === "undo" && !toast.leaving);
  useEffect(() => {
    if (!latestUndo) return undefined;
    const target = latestUndo;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.shiftKey || event.altKey || !(event.metaKey || event.ctrlKey)) return;
      // The physical Z key: on an Arabic layout the same key types «ئ».
      if (event.code !== "KeyZ" && event.key.toLowerCase() !== "z") return;
      if (isTyping(event.target)) return;
      event.preventDefault();
      act(target);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [latestUndo, act]);

  // Stable for the ~200 callers that list `toast` in the dependencies of an effect.
  const value = useMemo<ToastContextValue>(
    () => ({
      notify,
      success: (m) => notify("success", m),
      error: (m) => notify("error", m),
      undo,
    }),
    [notify, undo]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Top-centre, under the notch: the bottom of the screen belongs to the dock, the
          action bar and the save bar. Put straight into <body>, and only while there is
          something to show — so it sits above every sheet and dialog, and an open one
          does not take a press on «تراجع» for a press outside itself. */}
      {toasts.length > 0 &&
        createPortal(
          <div
            data-slot="toast-region"
            className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[70] flex flex-col items-center gap-2 px-3"
          >
            {toasts.map((toast) => (
              <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} onAction={act} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

/**
 * One toast: a status glyph and the message (never colour alone), the action
 * if it has one, and a close button. Its clock stops while the pointer is over
 * it or focus is inside it.
 */
function ToastItem({
  toast,
  onDismiss,
  onAction,
}: {
  toast: ToastRecord;
  onDismiss: (id: number) => void;
  onAction: (toast: ToastRecord) => void;
}) {
  const t = useT(STRINGS);
  const { id, kind, duration, leaving } = toast;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const remaining = useRef(duration);
  const wasPaused = useRef(false);

  useEffect(() => {
    if (leaving) return undefined;
    if (paused) {
      wasPaused.current = true;
      return undefined;
    }
    const started = Date.now();
    const wait = wasPaused.current ? Math.max(remaining.current, RESUME_MIN_MS) : remaining.current;
    const timer = window.setTimeout(() => onDismiss(id), wait);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, wait - (Date.now() - started));
    };
  }, [paused, leaving, id, onDismiss]);

  const StatusIcon = kind === "success" ? IconSuccess : kind === "error" ? IconError : IconUndo;
  const actionLabel = kind === "undo" ? t.undo : toast.action?.label;

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      // Spelled out although the role implies it: Base UI leaves [aria-live] alone when a dialog hides the rest of the page.
      aria-live={kind === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      data-slot="toast"
      data-kind={kind}
      data-leaving={leaving ? "" : undefined}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event: FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      className={cn(
        "pointer-events-auto flex w-fit max-w-full items-start gap-2.5 rounded-[1.25rem] bg-paper-raised py-2 ps-4 pe-2 text-sm text-ink shadow-[var(--shadow-pop)] ring-1 sm:max-w-md",
        // In: down 8px on the spring while it fades in. Out: a plain fade.
        "translate-y-0 [transition:opacity_var(--dur-fade)_var(--ease-out),translate_var(--dur-move)_var(--ease-spring)] motion-reduce:transition-none starting:-translate-y-2 starting:opacity-0",
        kind === "success" ? "ring-success/30" : kind === "error" ? "ring-danger/40" : "ring-line",
        leaving && "pointer-events-none opacity-0"
      )}
    >
      <span
        data-slot="toast-icon"
        className={cn(
          "mt-2 flex shrink-0",
          kind === "success" ? "text-success" : kind === "error" ? "text-danger" : "text-primary"
        )}
      >
        {/* The undo arrow points back along the reading direction. */}
        <StatusIcon weight="fill" className={cn("size-5", kind === "undo" && "rtl:-scale-x-100")} aria-hidden />
      </span>
      <p className="min-w-0 flex-auto py-1.5 leading-6 break-words">{toast.message}</p>
      {actionLabel && (
        <button
          type="button"
          data-slot="toast-action"
          aria-keyshortcuts={kind === "undo" ? "Control+Z Meta+Z" : undefined}
          onClick={() => {
            if (!leaving) onAction(toast);
          }}
          className="relative inline-flex h-9 shrink-0 cursor-pointer items-center rounded-full bg-primary-soft px-3.5 text-sm font-semibold whitespace-nowrap text-primary-dark transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none dark:text-primary"
        >
          {actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label={t.close}
        className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,color,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] before:absolute before:-inset-1 before:content-[''] hover:bg-ink/8 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none"
      >
        <IconClose className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
