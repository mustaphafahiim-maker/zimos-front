import { ToneSlider as SharedToneSlider } from "@store-builder/ui/appearance";
import { useLocale } from "@/i18n/LocaleContext";

interface ToneSliderProps {
  /** 0 (midnight blue) … 100 (slate). */
  value: number;
  onChange: (tone: number) => void;
}

/**
 * The tone of the Dark look, in the dashboard's language. The control itself
 * is shared with the platform console: packages/ui/src/appearance/ToneSlider.tsx.
 */
export function ToneSlider(props: ToneSliderProps) {
  const { locale } = useLocale();
  return <SharedToneSlider locale={locale} {...props} />;
}
