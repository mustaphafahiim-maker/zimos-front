/**
 * Minimal RFC 4180 CSV reader/writer — no dependencies.
 *
 * Handles: quoted fields, escaped quotes (""), commas / CR / LF inside quotes,
 * CRLF, LF and bare-CR line endings, a leading UTF-8 BOM, and any Unicode text
 * (Arabic included). Blank records are dropped but record numbers are kept so
 * error messages point at the same row a spreadsheet app shows.
 */

export const UTF8_BOM = "﻿";

export interface CsvRecord {
  /** 1-based record number (the header is record 1), counting blank records. */
  row: number;
  cells: string[];
}

/** Picks "," or ";" (Excel in some Arabic/European locales) from the first record. */
export function detectDelimiter(text: string): "," | ";" {
  let commas = 0;
  let semis = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === "\n" || ch === "\r") break;
      if (ch === ",") commas++;
      else if (ch === ";") semis++;
    }
  }
  return semis > commas ? ";" : ",";
}

export function parseCsvRecords(input: string, delimiter?: string): CsvRecord[] {
  const text = input.startsWith(UTF8_BOM) ? input.slice(1) : input;
  const delim = delimiter ?? detectDelimiter(text);
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let field = "";
  let inQuotes = false;
  let sawQuote = false;
  let recordNo = 1;

  const endField = () => {
    cells.push(field);
    field = "";
  };
  const endRecord = () => {
    endField();
    const blank = !sawQuote && cells.every((c) => c.trim() === "");
    if (!blank) records.push({ row: recordNo, cells });
    recordNo++;
    cells = [];
    sawQuote = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      sawQuote = true;
    } else if (ch === delim) {
      endField();
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      endRecord();
    } else if (ch === "\n") {
      endRecord();
    } else {
      field += ch;
    }
  }
  // Flush the last record unless the file ended with a newline.
  if (field !== "" || cells.length > 0 || sawQuote) endRecord();
  return records;
}

export function parseCsv(input: string, delimiter?: string): string[][] {
  return parseCsvRecords(input, delimiter).map((r) => r.cells);
}

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) || /^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialises rows with CRLF line endings (RFC 4180). Add UTF8_BOM when writing a file. */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>): string {
  return rows.map((r) => r.map((c) => escapeCell(c === null || c === undefined ? "" : String(c))).join(",")).join("\r\n") + "\r\n";
}

/** Decodes an uploaded file: UTF-8 first, falling back to Windows-1256 (legacy Arabic Excel). */
export async function readCsvFile(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  if (!utf8.includes("�")) return utf8;
  try {
    return new TextDecoder("windows-1256").decode(buf);
  } catch {
    return utf8;
  }
}

/** Triggers a browser download of a UTF-8 (with BOM) CSV so Excel shows Arabic correctly. */
export function downloadCsv(filename: string, rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>) {
  const blob = new Blob([UTF8_BOM + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
