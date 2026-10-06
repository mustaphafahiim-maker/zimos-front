/**
 * Import contacts from a CSV or Excel sheet (frontend-handoff 187; backend
 * src/modules/contacts/contactImport.js). customers.manage.
 *
 *   GET  /workspaces/:ws/contacts/import/template   the CSV template (UTF-8 with BOM)
 *   POST /workspaces/:ws/contacts/import            multipart: file (.csv/.xlsx, ≤5MB,
 *                                                   ≤5000 rows), mode, tags, dryRun
 *
 * Columns are matched by name, English or Arabic; only `phone` is required.
 * Marketing consent is turned on only by a row that says yes. `dryRun: true`
 * answers the same counts without saving anything.
 *
 * Codes: 422 INVALID_FILE (unreadable, or no phone column), 413
 * FILE_TOO_LARGE, 422 NO_FILE.
 */
import type { ApiClient } from "../client";

/** `update`: a phone already in the store takes the sheet's name/email/consent and its tags are added. `skip`: left alone. */
export type ContactImportMode = "update" | "skip";

export type ContactImportField = "phone" | "fullName" | "email" | "tags" | "consent";

export interface ContactImportRowError {
  row: number;
  /** Only "phone" skips the row; the others import it without that value. */
  field: "phone" | "email" | "marketing_consent" | (string & {});
  message: string;
}

export interface ContactImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  /** Already in the store with nothing new in the sheet. */
  unchanged: number;
  /** Rows without a usable phone; they are not imported. */
  invalid: number;
  dryRun: boolean;
  /** The sheet's column used for each field; null when the sheet has none. */
  columns: Record<ContactImportField, string | null>;
  /** The first 200 problems. */
  errors: ContactImportRowError[];
  /** Problems beyond those listed. */
  moreErrors: number;
}

export interface ContactImportOptions {
  mode: ContactImportMode;
  /** Comma-separated, added to every imported contact. */
  tags?: string;
  dryRun: boolean;
}

/** The largest file the server accepts (413 FILE_TOO_LARGE above it). */
export const CONTACT_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/contacts/import`;

/** ApiClient.rawFetch is private to the class (multipart needs it); reached through one typed cast, like catalog.ts. */
function rawFetch(client: ApiClient, path: string, init: RequestInit): Promise<Response> {
  return (client as unknown as { rawFetch(path: string, init: RequestInit): Promise<Response> }).rawFetch(path, init);
}

/** The template: phone,name,email,tags,marketing_consent and one example row. */
export async function contactImportTemplate(client: ApiClient, workspaceId: string): Promise<Blob> {
  const res = await rawFetch(client, `${base(workspaceId)}/template`, { headers: { Accept: "text/csv" } });
  return res.blob();
}

/** Checks (dryRun) or imports a sheet. The same file is sent again for the real import. */
export async function contactImport(
  client: ApiClient,
  workspaceId: string,
  file: File,
  options: ContactImportOptions
): Promise<ContactImportResult> {
  const form = new FormData();
  form.append("mode", options.mode);
  if (options.tags?.trim()) form.append("tags", options.tags.trim());
  form.append("dryRun", options.dryRun ? "true" : "false");
  form.append("file", file, file.name);
  const res = await rawFetch(client, base(workspaceId), { method: "POST", body: form });
  return (await res.json()) as ContactImportResult;
}
