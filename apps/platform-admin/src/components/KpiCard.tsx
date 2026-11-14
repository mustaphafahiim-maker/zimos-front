import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card, cn } from "@store-builder/ui";

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

/** One figure on the shared card, as the merchant dashboard draws it (its components/KpiCard.tsx): the label, the icon in its chip, the figure, the change. */
export function KpiCard({
  label,
  value,
  deltaBasisPoints,
  deltaLabel = "vs previous period",
  hint,
  to,
  icon,
  className,
}: KpiCardProps) {
  const delta = deltaBasisPoints ?? null;
  const up = delta !== null && delta > 0;
  const down = delta !== null && delta < 0;
  const body = (
    <Card className={cn("h-full gap-0 p-4", to && "transition-colors hover:border-primary/40", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-ink-soft">{label}</p>
        {icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary [&>svg]:size-4">{icon}</span>
        )}
      </div>
      <p className="tabular mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {delta !== null ? (
        <p className="mt-1 flex flex-wrap items-center gap-1 text-xs">
          <span className={cn("font-medium", up && "text-success", down && "text-danger", !up && !down && "text-ink-soft")}>
            {up ? "▲" : down ? "▼" : "•"} {(Math.abs(delta) / 100).toFixed(1)}%
          </span>
          <span className="text-ink-soft">{deltaLabel}</span>
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
