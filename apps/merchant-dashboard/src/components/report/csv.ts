/**
 * A CSV built in the browser and handed to the merchant as a download.
 *
 * Written so Excel opens it with Arabic intact: UTF-8 with a byte-order mark,
 * CRLF line ends, a comma between cells, a cell quoted when it holds a comma,
 * a quote or a line break (quotes doubled). A number is written as plain Latin
 * digits with a dot — no grouping, no currency, no Arabic-Indic digits — so a
 * spreadsheet reads it as a number and can add the column up.
 */

export type CsvCell = string | number | boolean | null | undefined;

/** The byte-order mark: with it Excel reads the file as UTF-8, and Arabic stays Arabic. */
const BOM = String.fromCharCode(0xfeff);

/**
 * A text cell a spreadsheet would run as a formula: it starts with = or @ (or a
 * tab / line break), or with + or - followed by anything but a number. A
 * customer's or a campaign's name must stay text, so such a cell is prefixed
 * with an apostrophe. "-12.5%" and "+201001234567" are left alone. (The class
 * of "number" characters also holds the Arabic-Indic digits and the Arabic
 * decimal and thousands marks, for a figure formatted for an Arabic reader.)
 */
const FORMULA_START = /^[=@\t\r]|^[+-](?![\d\s.,%٠-٩٫٬]*$)/;
const NEEDS_QUOTES = /[",\r\n]/;
/** Characters a file name cannot hold on Windows or macOS. */
const UNSAFE_IN_NAME = /[\\/:*?"<>|]+/g;

function plainNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 6 });
}

function cellText(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return plainNumber(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Downloads `rows` under `header` as `filename` (".csv" is added when missing).
 * Every row should have one cell per heading; null and undefined are written
 * as empty cells.
 */
export function downloadCsv(filename: string, header: readonly string[], rows: ReadonlyArray<ReadonlyArray<CsvCell>>): void {
  const table: ReadonlyArray<ReadonlyArray<CsvCell>> = [header, ...rows];
  const lines = table.map((line) => line.map(cellText).join(","));
  const blob = new Blob([BOM, lines.join("\r\n"), "\r\n"], { type: "text/csv;charset=utf-8" });
  const safe = filename.replace(UNSAFE_IN_NAME, "-").trim() || "report";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safe.toLowerCase().endsWith(".csv") ? safe : `${safe}.csv`;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // The browser needs a moment to start reading the blob before it is let go.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
