import { Fragment, type ReactNode } from "react";

/**
 * `fmt` for a template whose values are elements — a figure that has to stay
 * left-to-right inside an Arabic sentence: `fmtRich("Paid {paid} of {total}",
 * { paid: <Ltr>…</Ltr>, total: <Ltr>…</Ltr> })`. The words keep the order the
 * translation gives them.
 */
export function fmtRich(template: string, values: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={i}>{key !== undefined && key in values ? values[key] : part}</Fragment>;
  });
}

/** A figure, a phone number or a code: read left to right wherever it stands, in digits of one width. */
export function Ltr({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={className ?? "tabular-nums"}>
      {children}
    </bdi>
  );
}
