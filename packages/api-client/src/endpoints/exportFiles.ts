/**
 * Files built in the background (backend: src/modules/orders/exportFiles.js),
 * mounted at /workspaces/:workspaceId/exports.
 *
 *   POST /orders            202: the orders export (same options as the direct
 *                           download) goes to the queue; an `export.ready`
 *                           notification links to /exports/:id when it is built
 *   GET  /:exportId         its state (only the teammate who asked sees it)
 *   GET  /:exportId/download  the file, kept for 7 days (410 after)
 *
 * All exported names are prefixed `exportFile` / `ExportFile`.
 */
import type { ApiClient } from "../client";
import type { OrderExportParams } from "../types";

export type ExportFileStatus = "queued" | "running" | "done" | "failed" | "expired";

export interface ExportFile {
  id: string;
  kind: "orders";
  format: "csv" | "xlsx";
  status: ExportFileStatus;
  fileName: string | null;
  sizeBytes: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string | null;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/exports`;

// The class's own authenticated fetch (token refresh, ApiError), for the binary download.
function rawFetch(client: ApiClient, path: string, init: RequestInit): Promise<Response> {
  return (client as unknown as { rawFetch(path: string, init: RequestInit): Promise<Response> }).rawFetch(path, init);
}

export async function exportFileStartOrders(
  client: ApiClient,
  workspaceId: string,
  params: OrderExportParams & { format?: "csv" | "xlsx" },
): Promise<ExportFile> {
  const { export: file } = await client.request<{ export: ExportFile }>(`${base(workspaceId)}/orders`, {
    method: "POST",
    body: params,
  });
  return file;
}

export async function exportFileGet(client: ApiClient, workspaceId: string, exportId: string): Promise<ExportFile> {
  const { export: file } = await client.request<{ export: ExportFile }>(`${base(workspaceId)}/${exportId}`);
  return file;
}

export async function exportFileDownload(client: ApiClient, workspaceId: string, exportId: string): Promise<Blob> {
  const res = await rawFetch(client, `${base(workspaceId)}/${exportId}/download`, {});
  return res.blob();
}
