import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "@store-builder/ui";
import { useAuth } from "@/context/AuthContext";

/**
 * Asks before signing out: only its "Sign out" button signs out. Cancel,
 * Escape or a click outside closes it. Focus starts on Cancel and stays
 * inside while it is open; `onClose` puts it back where it belongs.
 */
export function SignOutDialog({ onClose }: { onClose: () => void }) {
  const { logout } = useAuth();
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const close = () => {
    if (!busy) onClose();
  };

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.nativeEvent.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab") return;
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await logout();
    } catch {
      // Signed out here all the same (AuthContext.logout); the sign-in page follows.
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-primary-dark/40 p-4 py-12 backdrop-blur-[2px] dark:bg-black/60"
      onMouseDown={close}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onKeyDown={onKeyDown}
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-slide-up w-full max-w-sm rounded-2xl border border-line bg-paper-raised shadow-lg"
      >
        <div className="px-5 pt-5">
          <h2 id={titleId} className="text-lg font-semibold text-ink">
            Sign out?
          </h2>
          <p id={bodyId} className="mt-1 text-sm text-ink-soft">
            You'll need to sign in again to open the console.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 px-5 py-4">
          <Button ref={cancelRef} variant="outline" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={signOut} disabled={busy}>
            {busy ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
