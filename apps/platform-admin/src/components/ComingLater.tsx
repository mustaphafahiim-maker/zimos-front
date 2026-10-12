import { Hourglass } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { comingLater: "Coming later" },
  ar: { comingLater: "قريبًا" },
} satisfies Messages;

interface ComingLaterProps {
  title: string;
  description: string;
  /** One sentence on what this area will cover. */
  summary: string;
}

/**
 * A console area that is planned but deliberately not built yet.
 *
 * Shows no rows, no sample data and no list of missing endpoints — only that
 * the area is coming later, so nobody mistakes it for a broken screen.
 */
export function ComingLater({ title, description, summary }: ComingLaterProps) {
  const t = useT(STRINGS);
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line bg-paper-raised px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Hourglass className="size-6" aria-hidden />
        </span>
        <div className="max-w-md space-y-1.5">
          <h2 className="text-base font-semibold text-ink">{t.comingLater}</h2>
          <p className="text-sm text-ink-soft">{summary}</p>
        </div>
      </div>
    </div>
  );
}
