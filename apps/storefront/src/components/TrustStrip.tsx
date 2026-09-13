import type { Dictionary } from "@/lib/i18n";
import { CashIcon, PhoneIcon, ReturnIcon, TruckIcon } from "./Icons";

/** Text-only reassurance row — no invented numbers. */
export function TrustStrip({ t, compact = false }: { t: Dictionary; compact?: boolean }) {
  const items = [
    { Icon: CashIcon, title: t.trust.cod, hint: t.trust.codHint },
    { Icon: TruckIcon, title: t.trust.fast, hint: t.trust.fastHint },
    { Icon: ReturnIcon, title: t.trust.returns, hint: t.trust.returnsHint },
    ...(compact ? [] : [{ Icon: PhoneIcon, title: t.trust.secure, hint: t.trust.secureHint }]),
  ];

  return (
    <ul className={`grid gap-3 ${compact ? "grid-cols-3" : "grid-cols-2 lg:grid-cols-4"}`}>
      {items.map(({ Icon, title, hint }) => (
        <li
          key={title}
          className={`flex items-center gap-3 rounded-2xl border border-line bg-paper-raised ${
            compact ? "flex-col px-2 py-3 text-center" : "p-4"
          }`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Icon />
          </span>
          <span className="min-w-0">
            <span className={`block font-semibold text-ink ${compact ? "text-xs" : "text-sm"}`}>{title}</span>
            {!compact && <span className="mt-0.5 block text-xs text-ink-soft">{hint}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
