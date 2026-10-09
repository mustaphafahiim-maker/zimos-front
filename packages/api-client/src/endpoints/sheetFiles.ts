/**
 * Excel beside CSV for two of the orders' sheets (frontend-handoff item 260).
 *
 *   POST /workspaces/:ws/checkout-sessions/export        orders.view
 *        body: the lost orders list's filters + `format: "csv" | "xlsx"` (csv when left out)
 *        csv  → { csv, count, filename: "lost-orders-YYYY-MM-DD.csv" }   (UTF-8 text with a BOM)
 *        xlsx → { base64, contentType, count, filename: "lost-orders-YYYY-MM-DD.xlsx" }
 *        The same columns either way, phones masked the same way, at most 5000 rows.
 *
 *   POST /workspaces/:ws/orders/import-tracking          orders.manage
 *        body: { csv } — the file's text — or { xlsx } — the .xlsx file, base64. Exactly one.
 *        Columns order_number (required), tracking_number, tracking_url, carrier, status;
 *        header names in any case, with spaces or dashes. The answer reports every row
 *        (OrderTrackingImportResult, endpoints/orders.ts).
 *        422 BAD_FILE — `xlsx` is not an Excel file; EMPTY_FILE / MISSING_COLUMN / TOO_MANY_ROWS as for a CSV.
 *
 * All exported names are prefixed `sheetFile` / `SheetFile`.
 */
import type { ApiClient } from "../client";
import type { LostOrderFilters } from "./lostOrders";
import type { OrderTrackingImportResult } from "./orders";

export type SheetFileFormat = "csv" | "xlsx";

/** A sheet ready to save: the file, the name the server gave it and how many rows it holds. */
export interface SheetFileDownload {
  blob: Blob;
  filename: string;
  count: number;
  /** What came back: an older server answers CSV whatever was asked. */
  format: SheetFileFormat;
}

/**
 * The largest tracking sheet the API takes: 1.5 MB of CSV text, or an .xlsx of
 * 1.5 MB (2,000,000 base64 characters). A bigger file is refused before it is read.
 */
export const SHEET_FILE_TRACKING_MAX_BYTES = 1_500_000;

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function blobFromBase64(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** A file's bytes as base64, the way the API takes an uploaded .xlsx. */
export function sheetFileToBase64(bytes: Uint8Array): string {
  let binary = "";
  // In chunks: one call with every byte as an argument overflows the stack on a large file.
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** True for a file that is an Excel workbook by its name or type (a courier's portal may send either). */
export function sheetFileIsXlsx(file: { name: string; type?: string }): boolean {
  return /\.xlsx$/i.test(file.name) || file.type === XLSX_TYPE;
}

/** The filtered lost orders list as a file: an Excel workbook, or CSV text Excel also opens. */
export async function sheetFileLostOrdersExport(
  client: ApiClient,
  workspaceId: string,
  filters: LostOrderFilters = {},
  format: SheetFileFormat = "xlsx"
): Promise<SheetFileDownload> {
  const answer = await client.request<{ csv?: string; base64?: string; contentType?: string; count: number; filename: string }>(
    `/workspaces/${workspaceId}/checkout-sessions/export`,
    { method: "POST", body: { ...filters, format } }
  );
  if (typeof answer.base64 === "string") {
    return {
      blob: blobFromBase64(answer.base64, answer.contentType || XLSX_TYPE),
      filename: answer.filename,
      count: answer.count,
      format: "xlsx",
    };
  }
  return {
    blob: new Blob([answer.csv ?? ""], { type: "text/csv;charset=utf-8" }),
    filename: answer.filename,
    count: answer.count,
    format: "csv",
  };
}

/**
 * Applies a courier's sheet: `{ csv }` is a CSV file's text, `{ xlsx }` an Excel
 * file as base64 (sheetFileToBase64). Same columns and the same per-row answer.
 */
export async function sheetFileImportTracking(
  client: ApiClient,
  workspaceId: string,
  file: { csv: string; xlsx?: never } | { xlsx: string; csv?: never }
): Promise<OrderTrackingImportResult> {
  return client.request<OrderTrackingImportResult>(`/workspaces/${workspaceId}/orders/import-tracking`, { method: "POST", body: file });
}
