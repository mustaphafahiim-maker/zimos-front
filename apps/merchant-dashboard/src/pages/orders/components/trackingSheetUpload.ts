import {
  ApiError,
  SHEET_FILE_TRACKING_MAX_BYTES,
  sheetFileImportTracking,
  sheetFileIsXlsx,
  sheetFileToBase64,
  type OrderTrackingImportResult,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";

/**
 * "Sync from file" takes the courier's sheet as CSV or as an Excel workbook
 * (handoff item 260). The file's first bytes decide how it is sent, so an
 * .xlsx saved under another name still works:
 *
 *   a zip (every .xlsx is one), or a file named .xlsx  → { xlsx: base64 }
 *   an old .xls workbook                               → refused here, the API reads .xlsx only
 *   anything else                                      → { csv: the text }
 *
 * A file the API could not take for its size is refused before it is sent.
 * Both refusals are thrown as the ApiError the server would answer, so the
 * dialog words them like any other (BAD_FILE, FILE_TOO_LARGE).
 */
// A zip's first entry: "PK" then 03 04 — bytes no CSV starts with, even one whose first title is "PKG".
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLD_XLS = [0xd0, 0xcf, 0x11, 0xe0];

const startsWith = (bytes: Uint8Array, magic: number[]) => magic.every((byte, i) => bytes[i] === byte);

const tooLarge = () => new ApiError("The file is too large", 413, "FILE_TOO_LARGE");

export async function importTrackingSheet(workspaceId: string, file: File): Promise<OrderTrackingImportResult> {
  // Nothing this big fits the API's request, whatever is inside: don't read it into memory.
  if (file.size > 2 * SHEET_FILE_TRACKING_MAX_BYTES) throw tooLarge();
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (startsWith(bytes, ZIP) || sheetFileIsXlsx(file)) {
    if (bytes.length > SHEET_FILE_TRACKING_MAX_BYTES) throw tooLarge();
    return sheetFileImportTracking(apiClient, workspaceId, { xlsx: sheetFileToBase64(bytes) });
  }
  if (startsWith(bytes, OLD_XLS)) throw new ApiError("This is not an Excel (.xlsx) file", 422, "BAD_FILE");

  const csv = new TextDecoder().decode(bytes);
  if (csv.trim() === "") throw new ApiError("The file has no rows under its header", 422, "EMPTY_FILE");
  if (csv.length > SHEET_FILE_TRACKING_MAX_BYTES) throw tooLarge();
  return sheetFileImportTracking(apiClient, workspaceId, { csv });
}
