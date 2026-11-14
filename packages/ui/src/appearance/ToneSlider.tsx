import { Button } from "../components/button";
import { RangeInput } from "../components/range-input";
import { TONE_DEFAULT, TONE_MIDNIGHT, TONE_SLATE } from "./store";
import { fill, type AppearanceLocale } from "./strings";

const STRINGS = {
  en: {
    tone: "Tone",
    midnight: "Midnight",
    slate: "Slate",
    atMidnight: "Midnight blue",
    atSlate: "Slate",
    atDefault: "The dark look as it always was",
    between: "{n} of 100",
  },
  ar: {
    tone: "درجة اللون",
    midnight: "ليلي",
    slate: "أردوازي",
    atMidnight: "أزرق ليلي",
    atSlate: "رمادي أردوازي",
    atDefault: "المظهر الداكن كما كان دائمًا",
    between: "{n} من 100",
  },
};

export interface ToneSliderProps {
  /** The language the dashboard is in. */
  locale: AppearanceLocale;
  /** 0 (midnight blue) … 100 (slate). */
  value: number;
  onChange: (tone: number) => void;
}

/**
 * The tone of the Dark look: a slider between its two ends, a button for each
 * end, and a line that says where the slider stands. The middle is the dark
 * look as it was before there was a tone.
 */
export function ToneSlider({ locale, value, onChange }: ToneSliderProps) {
  const t = STRINGS[locale];
  const words =
    value === TONE_MIDNIGHT ? t.atMidnight : value === TONE_SLATE ? t.atSlate : value === TONE_DEFAULT ? t.atDefault : fill(t.between, { n: value });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="min-h-9"
        aria-pressed={value === TONE_MIDNIGHT}
        onClick={() => onChange(TONE_MIDNIGHT)}
      >
        {t.midnight}
      </Button>
      <RangeInput label={t.tone} value={value} onChange={onChange} valueText={words} className="min-w-32 flex-1" />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="min-h-9"
        aria-pressed={value === TONE_SLATE}
        onClick={() => onChange(TONE_SLATE)}
      >
        {t.slate}
      </Button>
      <output className="basis-full text-[13px] leading-5 text-ink-soft">{words}</output>
    </div>
  );
}
