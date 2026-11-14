import type { SizeChartText, SizeChartUnit } from "@store-builder/api-client";
import type { Locale } from "./i18n";

/**
 * The size guide's arithmetic: the server keeps a
 * chart's numbers as the merchant typed them, in the chart's own unit; the
 * shopper's cm / inch switch converts them here (× or ÷ 2.54, one decimal).
 * A cell that is not a number — "S", "XL", "38 EU" — stays as it is.
 *
 * Pure, no React: shared by the sheet and testable on its own.
 */

const CM_PER_INCH = 2.54;
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const NUM = "[0-9٠-٩]+(?:[.,٫][0-9٠-٩]+)?";
const ONE = new RegExp(`^${NUM}$`);
// "96-100", "96 – 100": a range converts end by end and keeps its own dash.
const RANGE = new RegExp(`^(${NUM})(\\s*[-–—]\\s*)(${NUM})$`);

function parse(raw: string): number {
  const latin = raw.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d))).replace(/[,٫]/, ".");
  return Number(latin);
}

/** One decimal, in the digits the merchant wrote the cell in. */
function write(value: number, arabic: boolean): string {
  const text = value.toFixed(1);
  return arabic ? text.replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)]).replace(".", "٫") : text;
}

/** `cell` in the other unit when it is a number (or a range of two); itself otherwise. */
export function convertSizeCell(cell: string, from: SizeChartUnit, to: SizeChartUnit): string {
  if (from === to) return cell;
  const text = cell.trim();
  const factor = from === "cm" ? 1 / CM_PER_INCH : CM_PER_INCH;
  const arabic = /[٠-٩]/.test(text);
  const convert = (raw: string) => {
    const n = parse(raw);
    return Number.isFinite(n) ? write(n * factor, arabic) : raw;
  };
  if (ONE.test(text)) return convert(text);
  const range = RANGE.exec(text);
  if (range) return `${convert(range[1])}${range[2]}${convert(range[3])}`;
  return cell;
}

/** A heading or note in the shopper's language; the other language when it has none (French reads English). */
export function sizeChartText(text: SizeChartText | null | undefined, locale: Locale): string {
  const ar = text?.ar?.trim() ?? "";
  const en = text?.en?.trim() ?? "";
  return locale === "ar" ? ar || en : en || ar;
}
