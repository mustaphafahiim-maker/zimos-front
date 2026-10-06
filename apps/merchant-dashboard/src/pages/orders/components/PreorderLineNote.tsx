import { CalendarClock } from "lucide-react";
import { preorderShipsAtOf } from "@store-builder/api-client";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDay } from "@/lib/wholeNumber";

const STRINGS = {
  en: { line: "Pre-order — ships by {date}" },
  ar: { line: "طلب مسبق — هيتشحن قبل {date}" },
} satisfies Messages;

/**
 * Order page, under an item: the line was sold beyond stock as a pre-order
 * and carries its expected ship date (`preorderShipsAt`, handoff 195).
 */
export function PreorderLineNote({ item }: { item: unknown }) {
  const t = useT(STRINGS);
  const day = preorderShipsAtOf(item);
  if (!day) return null;
  return (
    <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-dark">
      <CalendarClock className="size-3.5 shrink-0" aria-hidden />
      {fmt(t.line, { date: formatDay(day) })}
    </span>
  );
}
