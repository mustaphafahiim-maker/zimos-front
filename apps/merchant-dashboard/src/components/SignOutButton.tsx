import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@store-builder/ui";
import { useAuth } from "@/context/AuthContext";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Sign out?",
    body: "You'll need to sign in again to manage your stores.",
    cancel: "Cancel",
    signOut: "Sign out",
    signingOut: "Signing out…",
  },
  ar: {
    title: "تسجيل الخروج؟",
    body: "ستحتاج إلى تسجيل الدخول مرة أخرى لإدارة متاجرك.",
    cancel: "إلغاء",
    signOut: "تسجيل الخروج",
    signingOut: "جارٍ تسجيل الخروج…",
  },
} satisfies Messages;

/**
 * A sign-out link that asks first: one click opens a confirmation, and only
 * its "Sign out" button signs out. Cancel, Escape or a click outside closes
 * it. Focus starts on Cancel, stays inside while it is open, and goes back to
 * the link when it closes. Rendered on document.body, so a drawer it is
 * opened from can't clip it.
 */
export function SignOutButton({ className, children }: { className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open && createPortal(<SignOutDialog onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function SignOutDialog({ onClose }: { onClose: () => void }) {
  const t = useT(STRINGS);
  const { logout } = useAuth();
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const close = () => {
    if (!busy) onClose();
  };

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      // Only this dialog closes, not a drawer it was opened from.
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

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink/40 p-4 py-12" onMouseDown={close}>
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onKeyDown={onKeyDown}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-paper-raised shadow-xl"
      >
        <div className="px-5 pt-5">
          <h2 id={titleId} className="font-display text-lg font-medium text-ink">
            {t.title}
          </h2>
          <p id={bodyId} className="mt-1 text-sm text-ink-soft">
            {t.body}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 px-5 py-4">
          <Button ref={cancelRef} variant="outline" onClick={close} disabled={busy}>
            {t.cancel}
          </Button>
          <Button variant="danger" onClick={signOut} disabled={busy}>
            {busy ? t.signingOut : t.signOut}
          </Button>
        </div>
      </div>
    </div>
  );
}
