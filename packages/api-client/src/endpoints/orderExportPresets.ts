import type { ApiClient } from "../client";

/**
 * Courier export layouts (backend orders/exportPresets.js): a courier's own
 * column titles in its order, each filled from one of the export's columns
 * (GET /orders/export/columns) or a fixed value. The export takes `preset`.
 */
export type OrderExportPresetColumn = { header: string; key: string } | { header: string; fixed: string };

export interface OrderExportPreset {
  id: string;
  name: string;
  rowPer: "order" | "item";
  format: "csv" | "xlsx";
  columns: OrderExportPresetColumn[];
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/orders/export/presets`;

export async function orderExportPresetsList(client: ApiClient, workspaceId: string): Promise<OrderExportPreset[]> {
  const { presets } = await client.request<{ presets: OrderExportPreset[] }>(base(workspaceId));
  return presets;
}

/** Creates one (no id) or replaces one (with its id). orders.manage. */
export async function orderExportPresetSave(
  client: ApiClient,
  workspaceId: string,
  preset: Omit<OrderExportPreset, "id"> & { id?: string }
): Promise<OrderExportPreset> {
  const { preset: saved } = await client.request<{ preset: OrderExportPreset }>(base(workspaceId), { method: "PUT", body: preset });
  return saved;
}

export async function orderExportPresetDelete(client: ApiClient, workspaceId: string, presetId: string): Promise<void> {
  await client.request(`${base(workspaceId)}/${presetId}`, { method: "DELETE" });
}

/** The courier's header row pasted from Excel (tabs) or a CSV line (commas or semicolons), as titles. */
export function orderExportHeadersFromPaste(text: string): string[] {
  const line = text.replace(/\r/g, "").split("\n").find((l) => l.trim()) ?? "";
  const separator = line.includes("\t") ? "\t" : line.includes(";") && !line.includes(",") ? ";" : ",";
  return line
    .split(separator)
    .map((h) => h.trim().replace(/^"(.*)"$/, "$1").trim())
    .filter(Boolean)
    .slice(0, 60);
}
