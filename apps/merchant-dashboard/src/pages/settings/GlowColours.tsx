import { GlowColours as SharedGlowColours } from "@store-builder/ui/appearance";
import { useLocale } from "@/i18n/LocaleContext";

/**
 * The colours the glass backdrop glows in, in the dashboard's language. The
 * control itself is shared with the platform console:
 * packages/ui/src/appearance/GlowColours.tsx.
 */
export function GlowColours() {
  const { locale } = useLocale();
  return <SharedGlowColours locale={locale} />;
}
