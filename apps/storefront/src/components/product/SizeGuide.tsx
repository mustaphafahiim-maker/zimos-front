"use client";

import { useEffect, useId, useState, type SVGProps } from "react";
import { createPortal } from "react-dom";
import { storefrontSizeChart, type SizeChartUnit, type StorefrontSizeChart } from "@store-builder/api-client";
import { CrossIcon } from "@/components/Icons";
import { backdrop, focusRing, iconBtn, modalLayer, pill, sheet } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { pickText } from "@/lib/i18n";
import { convertSizeCell, sizeChartText } from "@/lib/sizeChart";
import { useStore } from "@/lib/StoreContext";
import { useDialog, useSheetPresence } from "@/lib/useDialog";

/**
 * «دليل المقاسات» on the product page. The link shows
 * only for a product that has a chart — its own, or its collection's (GET
 * /store/:ws/size-chart?productId=, cached five minutes). It opens a sheet
 * with the table in the shopper's language, a cm / inch switch, the
 * merchant's note and the "how to measure" picture.
 *
 * The switch converts the numbers (lib/sizeChart.ts). The first column is the
 * size's own name — S, M, 42 — so it is never converted, even when it is a
 * number.
 */

const TEXT = {
  en: {
    link: "Size guide",
    title: "Size guide",
    unit: "Unit",
    cm: "cm",
    inch: "inch",
    converted: "Converted and rounded to one decimal.",
    picture: "How to measure",
  },
  ar: {
    link: "دليل المقاسات",
    title: "دليل المقاسات",
    unit: "الوحدة",
    cm: "سم",
    inch: "بوصة",
    converted: "الأرقام محوّلة ومتقرّبة لأقرب رقم عشري.",
    picture: "إزاي تقيس",
  },
};

/** A ruler, drawn like components/Icons.tsx (24px grid, 1.8 stroke). */
function RulerIcon({ size = 18, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <rect x="2.5" y="8" width="19" height="8" rx="1.5" />
      <path d="M6.5 8v3M10 8v4M13.5 8v3M17 8v4" />
    </svg>
  );
}

// One request per product per page life, shared by every place that asks.
const asked = new Map<string, Promise<StorefrontSizeChart | null>>();

function ask(workspaceId: string, productId: string): Promise<StorefrontSizeChart | null> {
  const key = `${workspaceId}:${productId}`;
  let answer = asked.get(key);
  if (!answer) {
    // No chart and no answer look the same to the shopper: no link.
    answer = storefrontSizeChart(createStorefrontApiClient(), workspaceId, productId).catch(() => {
      asked.delete(key);
      return null;
    });
    asked.set(key, answer);
  }
  return answer;
}

export function SizeGuideLink({
  workspaceId,
  productId,
  placement = "inline",
}: {
  workspaceId: string;
  productId: string;
  /**
   * "inline": a line of its own (a product with no option to hang it on).
   * "corner": on an option's title row (OptionPicker's `aside`) — the link is
   * only known once the chart was asked for, and there it lands without
   * pushing the options or the buy buttons down.
   */
  placement?: "inline" | "corner";
}) {
  const { locale } = useStore();
  const text = pickText(TEXT, locale);
  const [found, setFound] = useState<{ productId: string; chart: StorefrontSizeChart | null } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void ask(workspaceId, productId).then((chart) => {
      if (alive) setFound({ productId, chart });
    });
    return () => {
      alive = false;
    };
  }, [workspaceId, productId]);

  const chart = found && found.productId === productId ? found.chart : null;
  if (!chart || chart.columns.length === 0 || chart.rows.length === 0) return null;

  return (
    <div className={placement === "corner" ? undefined : "-my-2"}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`inline-flex cursor-pointer gap-2 whitespace-nowrap rounded-lg text-sm font-semibold text-primary underline-offset-4 hover:underline ${focusRing} ${
          // In the corner the 44px to press reach up from the title's line, whose text the link shares.
          placement === "corner" ? "h-11 items-end pb-0.5" : "min-h-11 items-center"
        }`}
      >
        <RulerIcon className={placement === "corner" ? "mb-px shrink-0" : "shrink-0"} />
        {text.link}
      </button>
      <SizeGuideSheet chart={chart} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function SizeGuideSheet({ chart, open, onClose }: { chart: StorefrontSizeChart; open: boolean; onClose: () => void }) {
  const { locale, t } = useStore();
  const text = pickText(TEXT, locale);
  const titleId = useId();
  const dialogRef = useDialog<HTMLDivElement>({ open, onClose });
  const { present, shown } = useSheetPresence(open);
  const [unit, setUnit] = useState<SizeChartUnit>(chart.unit);
  const note = sizeChartText(chart.note, locale);
  const units: SizeChartUnit[] = ["cm", "inch"];

  if (!present) return null;
  return createPortal(
    <div className={modalLayer}>
      <div className={backdrop(shown)} aria-hidden onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!open}
        inert={!open}
        className={sheet(shown)}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-4 sm:px-5">
          <h2 id={titleId} className="flex items-center gap-2 font-display text-lg font-bold text-ink">
            <RulerIcon size={20} className="text-primary" />
            {text.title}
          </h2>
          <button type="button" onClick={onClose} aria-label={t.common.close} className={iconBtn}>
            <CrossIcon />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
          <div role="group" aria-label={text.unit} className="flex items-center gap-2">
            <span className="me-1 text-sm font-medium text-ink-soft">{text.unit}</span>
            {units.map((u) => (
              <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)} className={pill(unit === u)}>
                {text[u]}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-paper text-ink-soft">
                  {chart.columns.map((column, c) => (
                    <th
                      key={c}
                      scope="col"
                      className={`whitespace-nowrap px-3 py-3 text-start font-semibold ${c === 0 ? "sticky start-0 bg-paper" : ""}`}
                    >
                      {sizeChartText(column, locale)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((row, r) => (
                  <tr key={r} className="border-t border-line">
                    {chart.columns.map((_, c) => {
                      const cell = row[c] ?? "";
                      return c === 0 ? (
                        <th key={c} scope="row" className="sticky start-0 whitespace-nowrap bg-paper-raised px-3 py-3 text-start font-semibold text-ink">
                          <bdi>{cell}</bdi>
                        </th>
                      ) : (
                        <td key={c} className="whitespace-nowrap px-3 py-3 text-ink tabular-nums">
                          <bdi>{convertSizeCell(cell, chart.unit, unit)}</bdi>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-ink-soft empty:hidden">{unit !== chart.unit ? text.converted : ""}</p>

          {note && (
            <p dir="auto" className="whitespace-pre-line rounded-2xl bg-paper px-4 py-3 text-sm leading-relaxed text-ink">
              {note}
            </p>
          )}

          {chart.imageUrl && (
            <figure>
              <figcaption className="mb-2 text-sm font-semibold text-ink">{text.picture}</figcaption>
              {/* Merchant media are arbitrary remote URLs (no next/image allowlist). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={chart.imageUrl} alt={text.picture} loading="lazy" className="w-full rounded-2xl border border-line" />
            </figure>
          )}
        </div>
      </div>
    </div>,
    document.querySelector<HTMLElement>(".brand-theme") ?? document.body
  );
}
