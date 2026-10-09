import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  // Same words as the Modal's own discard prompt (components/Modal.tsx): one vocabulary for one decision.
  en: {
    title: "Discard changes?",
    body: "Your changes on this tab aren't saved yet. Leave and lose them, or keep editing and save.",
    leave: "Discard",
    stay: "Keep editing",
  },
  ar: {
    title: "تسيب التعديلات؟",
    body: "التعديلات اللي في التبويب ده لسه ما اتحفظتش. تسيبها وتضيع، ولا تكمّل وتحفظ؟",
    leave: "سيبها",
    stay: "كمّل تعديل",
  },
} satisfies Messages;

interface UnsavedGuardValue {
  dirty: boolean;
  /** Keyed by source, so two forms on one page cannot overwrite each other's flag. */
  setDirty: (source: string, dirty: boolean) => void;
  confirmLeave: () => Promise<boolean>;
}

const UnsavedGuardContext = createContext<UnsavedGuardValue | null>(null);

/**
 * One place that knows whether anything on the page is unsaved and asks
 * before it would be lost. A tabbed page wraps its tab area in this, and asks
 * `confirmLeave()` before switching tabs; the forms inside report through
 * `useUnsavedGuard().setDirty`. While anything is dirty the browser's own
 * reload / close prompt is armed here, once, instead of in every form.
 *
 * In-app links to another route are not caught: the app is a plain
 * BrowserRouter with no route blockers, so leaving the page is only guarded
 * by the browser prompt on reload and close.
 */
export function UnsavedGuardProvider({ children }: { children: ReactNode }) {
  const t = useT(STRINGS);
  const [dirtySources, setDirtySources] = useState<ReadonlySet<string>>(() => new Set<string>());
  const dirty = dirtySources.size > 0;
  // The open question, if there is one. Calling it answers it and closes the dialog.
  const [pending, setPending] = useState<((leave: boolean) => void) | null>(null);
  const pendingPromise = useRef<Promise<boolean> | null>(null);

  const setDirty = useCallback((source: string, value: boolean) => {
    setDirtySources((prev) => {
      if (prev.has(source) === value) return prev;
      const next = new Set(prev);
      if (value) next.add(source);
      else next.delete(source);
      return next;
    });
  }, []);

  const confirmLeave = useCallback(() => {
    if (!dirty) return Promise.resolve(true);
    // A second question while one is open shares its answer.
    if (pendingPromise.current) return pendingPromise.current;
    const promise = new Promise<boolean>((resolve) => {
      setPending(() => (leave: boolean) => {
        pendingPromise.current = null;
        setPending(null);
        resolve(leave);
      });
    });
    pendingPromise.current = promise;
    return promise;
  }, [dirty]);

  // Nothing left to lose while the question is open (the form saved, or went away): let it through.
  useEffect(() => {
    if (!dirty && pending) pending(true);
  }, [dirty, pending]);

  // Reload / close. The browser shows its own wording; the string is what older ones require.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const value = useMemo<UnsavedGuardValue>(
    () => ({ dirty, setDirty, confirmLeave }),
    [dirty, setDirty, confirmLeave]
  );

  // A .ts file, hence createElement: the same tree as
  // <Provider value>{children}<ConfirmDialog … /></Provider>.
  return createElement(
    UnsavedGuardContext.Provider,
    { value },
    children,
    createElement(ConfirmDialog, {
      open: pending !== null,
      title: t.title,
      description: t.body,
      confirmLabel: t.leave,
      cancelLabel: t.stay,
      destructive: true,
      onCancel: () => pending?.(false),
      onConfirm: () => pending?.(true),
    })
  );
}

function alwaysLeave() {
  return Promise.resolve(true);
}

/**
 * How a form reports unsaved edits, and how a tab switch asks before dropping
 * them. `confirmLeave()` answers true at once when nothing is dirty, otherwise
 * it opens the dialog and answers with the merchant's choice. Outside a
 * provider nothing is guarded: `setDirty` is a no-op and leaving is always
 * fine, so a form can render on its own.
 */
export function useUnsavedGuard(): {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  confirmLeave: () => Promise<boolean>;
} {
  const ctx = useContext(UnsavedGuardContext);
  const source = useId();
  const report = ctx?.setDirty;
  const setDirty = useCallback((value: boolean) => report?.(source, value), [report, source]);

  // A form that unmounts takes its flag with it, whatever it last reported.
  useEffect(() => {
    return () => {
      report?.(source, false);
    };
  }, [report, source]);

  return {
    dirty: ctx?.dirty ?? false,
    setDirty,
    confirmLeave: ctx?.confirmLeave ?? alwaysLeave,
  };
}

/** One line for a form that already computes its own dirty flag: keeps the guard told. */
export function useReportDirty(dirty: boolean): void {
  const { setDirty } = useUnsavedGuard();
  useEffect(() => {
    setDirty(dirty);
  }, [dirty, setDirty]);
}
