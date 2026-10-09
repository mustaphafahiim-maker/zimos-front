import { CATALOG_SHEET_UPDATE_MAX_ROWS, catalogSheetUpdateRowProblem, type CatalogSheetFileProblem } from "@store-builder/api-client";
import { fmt } from "@/i18n/LocaleContext";
import type { SheetUpdateStrings } from "./sheetUpdateStrings";

/**
 * A row's problem in the merchant's language. The server words them in
 * English only; the ones it is known to send are said here with the handoff's
 * wording, and anything else is shown as it came.
 */
export function sheetRowProblemText(t: SheetUpdateStrings, message: string): string {
  return known(t, message) ?? message;
}

/** True when the server's own sentence is shown: its direction is then read from the text, not from the screen's language. */
export function sheetRowProblemIsVerbatim(message: string): boolean {
  return catalogSheetUpdateRowProblem(message).kind === "other";
}

function known(t: SheetUpdateStrings, message: string): string | null {
  const problem = catalogSheetUpdateRowProblem(message);
  switch (problem.kind) {
    case "no_sku":
      return t.problem_no_sku;
    case "duplicate_row":
      return t.problem_duplicate_row;
    case "shared_sku":
      return t.problem_shared_sku;
    case "stock_and_change":
      return t.problem_stock_and_change;
    case "bad_stock":
      return t.problem_bad_stock;
    case "bad_stock_change":
      return t.problem_bad_stock_change;
    case "below_zero":
      return problem.now === null ? t.problem_below_zero : fmt(t.problem_below_zero_now, { now: problem.now });
    case "bad_amount":
      return problem.column === "price" ? t.problem_bad_price : problem.column === "compare_at" ? t.problem_bad_compare_at : t.problem_bad_cost;
    case "zero_price":
      return t.problem_zero_price;
    case "location_short":
      return fmt(t.problem_location_short, { n: problem.available, location: problem.location });
    default:
      return null;
  }
}

/** Why a whole sheet was refused, in the merchant's language. */
export function sheetFileProblemText(t: SheetUpdateStrings, problem: CatalogSheetFileProblem): string {
  switch (problem) {
    case "no_sku_column":
      return t.file_no_sku_column;
    case "damaged":
      return t.file_damaged;
    case "empty":
      return t.file_empty;
    case "too_many_rows":
      return fmt(t.file_too_many_rows, { rows: CATALOG_SHEET_UPDATE_MAX_ROWS });
    case "too_large":
      return t.file_too_large;
    default:
      return t.file_unreadable;
  }
}
