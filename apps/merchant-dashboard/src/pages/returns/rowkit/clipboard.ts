import { useCallback } from "react";
import { useToast } from "@/components/Toast";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { failed: "We couldn't copy that. Try again." },
  ar: { failed: "معرفناش ننسخ. جرّب تاني." },
} satisfies Messages;

/** Puts `value` on the clipboard; false when the browser would not. */
export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // No permission, or an origin without the clipboard API: the old selection way still works there.
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      field.remove();
    }
  }
}

/** Copy, and say so: `done` in a toast when it worked, one shared sentence when it did not. */
export function useCopy(): (value: string, done: string) => void {
  const toast = useToast();
  const t = useT(STRINGS);
  return useCallback(
    (value: string, done: string) => {
      void copyText(value).then((ok) => {
        if (ok) toast.success(done);
        else toast.error(t.failed);
      });
    },
    [toast, t]
  );
}
