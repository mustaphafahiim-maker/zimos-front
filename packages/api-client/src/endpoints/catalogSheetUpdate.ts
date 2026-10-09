/**
 * Bulk stock and price update from a sheet (backend: frontend-handoff items 243, 295, 297;
 * src/modules/catalog/importExport/bulkUpdate.js). products.manage for both calls.
 *
 * A CSV or .xlsx (≤ 10 MB, ≤ 5000 rows) with a header row. `sku` names the variant (this
 * store's, any case); the other columns are optional and a blank cell leaves the value alone:
 *   stock          the new on-hand count
 *   stock_change   + or − units (not with `stock` on the same row)
 *   price, compare_at, cost   in major units as typed ("249.50" or "249,50"); compare_at 0 clears it
 *
 * /workspaces/:ws/catalog/bulk-update:
 *   POST /preview  multipart `file` → CatalogSheetUpdatePreview — nothing changes
 *   POST /apply    multipart `file` + `Idempotency-Key` → CatalogSheetUpdateResult. A second call
 *        with the same key answers the first result, or 409 IDEMPOTENCY_KEY_IN_PROGRESS while
 *        the first still runs. `stock` sets the count against the stock at that moment;
 *        `stock_change` moves it by its own amount.
 *   422 VALIDATION_ERROR on `file` when the sheet cannot be read at all (no `sku` column, a
 *   damaged .xlsx, an empty file, too many rows); 422 UPLOAD_ERROR past 10 MB.
 *
 * The server words its row problems in English only: `catalogSheetUpdateRowProblem` names the
 * ones it knows so the apps can say them in the merchant's language.
 * All exported names are prefixed `catalogSheetUpdate` / `CatalogSheet`.
 */
import { ApiError, type ApiClient } from "../client";
import { apiFieldProblems, isApiErrorCode } from "../errors";

/** The columns the update reads, in the template's order. */
export const CATALOG_SHEET_UPDATE_COLUMNS = ["sku", "stock", "stock_change", "price", "compare_at", "cost"] as const;
/** The largest file the API takes. */
export const CATALOG_SHEET_UPDATE_MAX_BYTES = 10 * 1024 * 1024;
/** The most rows one sheet can have. */
export const CATALOG_SHEET_UPDATE_MAX_ROWS = 5000;

/** The amount columns as the answers name them. Minor units of the variant's currency, as strings. */
export type CatalogSheetAmountField = "priceAmount" | "compareAtAmount" | "costAmount";

export interface CatalogSheetWarning {
  /** BELOW_RESERVED: the new count is under what open orders hold (`reserved`). */
  code: "BELOW_RESERVED" | (string & {});
  reserved?: number;
}

/** One row of the sheet that changes something: each changed field as old → new. */
export interface CatalogSheetChange {
  /** The line in the file (the header is line 1). */
  row: number;
  sku: string;
  variantId: string;
  productName: string | null;
  options: Record<string, string> | null;
  fields: {
    stock?: { from: number; to: number };
  } & Partial<Record<CatalogSheetAmountField, { from: string | null; to: string | null }>>;
  /** Set when the row used `stock_change`: applied as this change on the stock at that moment. */
  stockChange?: number;
  warnings?: CatalogSheetWarning[];
}

export interface CatalogSheetUnknownRow {
  row: number;
  sku: string;
}

export interface CatalogSheetRowError {
  row: number;
  sku?: string;
  /** English, from the server — see `catalogSheetUpdateRowProblem`. */
  message: string;
}

export interface CatalogSheetUpdatePreview {
  /** Rows read from the sheet (blank ones dropped). */
  rows: number;
  changes: CatalogSheetChange[];
  /** Rows whose SKU is no variant of this store. */
  unknown: CatalogSheetUnknownRow[];
  errors: CatalogSheetRowError[];
  /** Header names the update does not read ("name", …). */
  ignoredColumns?: string[];
  summary: { rows: number; changes: number; unknown: number; errors: number; ignoredColumns?: number };
}

export interface CatalogSheetUpdateResult {
  /** Rows whose changes were made. */
  applied: number;
  /** Rows that were valid in the sheet but could not be applied. */
  failed: Array<{ row: number; sku: string; message: string }>;
  unknown: CatalogSheetUnknownRow[];
  errors: CatalogSheetRowError[];
  ignoredColumns?: string[];
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/catalog/bulk-update`;

/** ApiClient.rawFetch is private to the class (multipart needs it); reached through one typed cast, like catalog.ts. */
function rawFetch(client: ApiClient, path: string, init: RequestInit): Promise<Response> {
  return (client as unknown as { rawFetch(path: string, init: RequestInit): Promise<Response> }).rawFetch(path, init);
}

function sheetForm(file: File): FormData {
  const form = new FormData();
  form.append("file", file, file.name);
  return form;
}

/** What the sheet would change, row by row. Nothing is written. */
export async function catalogSheetUpdatePreview(client: ApiClient, workspaceId: string, file: File): Promise<CatalogSheetUpdatePreview> {
  const res = await rawFetch(client, `${base(workspaceId)}/preview`, { method: "POST", body: sheetForm(file) });
  return (await res.json()) as CatalogSheetUpdatePreview;
}

/**
 * Applies the sheet's valid rows. `idempotencyKey`: one new key per chosen file
 * (`catalogSheetUpdateKey`), sent again unchanged on a retry, so a second press
 * or a retry after a lost answer cannot apply the sheet twice.
 */
export async function catalogSheetUpdateApply(
  client: ApiClient,
  workspaceId: string,
  file: File,
  idempotencyKey: string
): Promise<CatalogSheetUpdateResult> {
  const res = await rawFetch(client, `${base(workspaceId)}/apply`, {
    method: "POST",
    body: sheetForm(file),
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return (await res.json()) as CatalogSheetUpdateResult;
}

/** A fresh key for one upload's apply. */
export function catalogSheetUpdateKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

/** True for the 409 an apply answers while the first call with the same key is still running. */
export function catalogSheetUpdateStillApplying(err: unknown): boolean {
  return isApiErrorCode(err, "IDEMPOTENCY_KEY_IN_PROGRESS");
}

/** The template: the header row only, as a CSV that Excel opens (UTF-8 with a BOM). */
export function catalogSheetUpdateTemplate(): Blob {
  return new Blob([`\uFEFF${CATALOG_SHEET_UPDATE_COLUMNS.join(",")}\r\n`], { type: "text/csv;charset=utf-8" });
}

/** Why a whole sheet was refused. */
export type CatalogSheetFileProblem =
  | "no_sku_column"
  /** A broken or fake .xlsx. */
  | "damaged"
  | "empty"
  | "too_many_rows"
  | "too_large"
  /** Refused for a reason this list does not name. */
  | "unreadable";

/** The reason a preview or apply refused the file itself; null for any other failure. */
export function catalogSheetUpdateFileProblem(err: unknown): CatalogSheetFileProblem | null {
  if (!(err instanceof ApiError)) return null;
  if (err.status === 413) return "too_large";
  // multer's refusal (a file past 10 MB, or more than one), in the server's English (kept as `messageEn` when translated).
  if (err.code === "UPLOAD_ERROR") {
    const body = err.details as { error?: { messageEn?: unknown } } | null | undefined;
    const english = body && typeof body === "object" && typeof body.error?.messageEn === "string" ? body.error.messageEn : err.message;
    return /too large/i.test(english) ? "too_large" : "unreadable";
  }
  const problem = apiFieldProblems(err).find((p) => p.field === "file");
  if (!problem) return null;
  const message = problem.message;
  if (/needs a `?sku`? column/i.test(message)) return "no_sku_column";
  if (/more than \d+ rows|at most \d+ rows/i.test(message)) return "too_many_rows";
  if (/file is empty/i.test(message)) return "empty";
  if (/too large/i.test(message)) return "too_large";
  if (/not a valid \.xlsx|damaged|has no sheet|compression/i.test(message)) return "damaged";
  return "unreadable";
}

/** A row problem the server reported, named. `other` keeps the server's sentence. */
export type CatalogSheetRowProblem =
  | { kind: "no_sku" }
  | { kind: "duplicate_row" }
  | { kind: "shared_sku" }
  | { kind: "stock_and_change" }
  | { kind: "bad_stock" }
  | { kind: "bad_stock_change" }
  /** `now`: the stock the change was checked against, when the server said it. */
  | { kind: "below_zero"; now: number | null }
  | { kind: "bad_amount"; column: "price" | "compare_at" | "cost"; decimals: number }
  | { kind: "zero_price" }
  /** With stock locations: the default location holds only `available` of it. */
  | { kind: "location_short"; available: number; location: string }
  | { kind: "other"; message: string };

/** Reads a row error (or an apply failure) of the bulk update into the problem it reports. */
export function catalogSheetUpdateRowProblem(message: string): CatalogSheetRowProblem {
  const text = message.trim();
  if (/^no sku$/i.test(text)) return { kind: "no_sku" };
  if (/earlier row/i.test(text)) return { kind: "duplicate_row" };
  if (/several variants share/i.test(text)) return { kind: "shared_sku" };
  if (/stock or stock_change, not both/i.test(text)) return { kind: "stock_and_change" };
  if (/^stock must be a whole number/i.test(text)) return { kind: "bad_stock" };
  if (/^stock_change must be a whole number/i.test(text)) return { kind: "bad_stock_change" };
  const below = /^stock would go below (?:0|zero)(?: \(now (-?\d+)\))?$/i.exec(text);
  if (below) return { kind: "below_zero", now: below[1] === undefined ? null : Number(below[1]) };
  const amount = /^(price|compare_at|cost) must be an amount like [\d.]+ \(at most (\d+) decimals?\)$/i.exec(text);
  if (amount) return { kind: "bad_amount", column: amount[1].toLowerCase() as "price" | "compare_at" | "cost", decimals: Number(amount[2]) };
  if (/^price cannot be 0$/i.test(text)) return { kind: "zero_price" };
  const short = /^Only (\d+) (?:on hand )?at (.+?)(?:; change the other locations' counts there)?$/i.exec(text);
  if (short) return { kind: "location_short", available: Number(short[1]), location: short[2] };
  return { kind: "other", message };
}
