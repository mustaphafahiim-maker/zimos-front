import { useCallback, useState } from "react";
import { useToast } from "@/components/Toast";
import { getErrorMessage } from "@/lib/errors";

/** Wraps a mutation with busy state and toast feedback. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, success?: string | ((r: T) => string)): Promise<T | undefined> => {
      setBusy(key);
      try {
        const r = await fn();
        if (success) toast.success(typeof success === "function" ? success(r) : success);
        return r;
      } catch (err) {
        toast.error(getErrorMessage(err));
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [toast]
  );
  return { busy, run };
}
