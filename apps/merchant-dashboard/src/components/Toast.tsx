import type { ReactNode } from "react";
import { ToastProvider as SharedToastProvider } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";

export { useToast } from "@store-builder/ui";

const STRINGS = {
  en: { dismiss: "Dismiss" },
  ar: { dismiss: "إخفاء" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useT(STRINGS);
  return <SharedToastProvider dismissLabel={t.dismiss}>{children}</SharedToastProvider>;
}
