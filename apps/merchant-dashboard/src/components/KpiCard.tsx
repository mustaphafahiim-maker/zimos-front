import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card, cn } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";
import { formatPercentValue } from "@/lib/format";

const STRINGS = {
  en: { vsPrevious: "vs previous period" },
  ar: { vsPrevious: "مقارنة بالفترة السابقة" },
};

interface KpiCardProps {
  label: string;
  value: ReactNode;
  /** Change vs previous period, in basis points (250 = +2.5%). */
  deltaBasisPoints?: number | null;
  deltaLabel?: string;
  hint?: string;
  to?: string;
  icon?: ReactNode;
  className?: string;
}

export function KpiCard({ label, value, deltaBasisPoints, deltaLabel, hint, to, icon, className }: KpiCardProps) {
  const t = useT(STRINGS);
  const delta = deltaBasisPoints ?? null;
  const up = delta !== null && delta > 0;
  const down = delta !== null && delta < 0;
  const body = (
    <Card className={cn("h-full gap-0 p-4", to && "transition-colors hover:border-primary/40", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-ink-soft">{label}</p>
        {icon && (
          <span className="flex size-8 items-center justify-center rounded-[10px] bg-primary-soft text-primary [&>svg]:size-4">
            {icon}
          </span>
        )}
      </div>
      <p className="tabular-nums mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {delta !== null ? (
        <p className="mt-1 flex flex-wrap items-center gap-1 text-xs">
          <span className={cn("font-medium", up && "text-success", down && "text-danger", !up && !down && "text-ink-soft")}>
            {up ? "▲" : down ? "▼" : "•"} {formatPercentValue(Math.abs(delta) / 10000)}
          </span>
          <span className="text-ink-soft">{deltaLabel ?? t.vsPrevious}</span>
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-soft">{hint}</p>
      ) : null}
    </Card>
  );
  return to ? (
    <Link to={to} className="block rounded-2xl">
      {body}
    </Link>
  ) : (
    body
  );
}
