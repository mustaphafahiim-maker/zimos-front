import { ZimosMark, cn } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { loading: "Loading…" },
  ar: { loading: "جارٍ التحميل…" },
};

/** Full-screen branded loading state: the ZIMOS mark with a subtle pulse. */
export function BrandLoader({ className }: { className?: string }) {
  const t = useT(STRINGS);
  return (
    <div
      className={cn("flex min-h-screen items-center justify-center bg-paper", className)}
      role="status"
      aria-live="polite"
    >
      <ZimosMark size={40} className="animate-pulse" alt="" />
      <span className="sr-only">{t.loading}</span>
    </div>
  );
}
