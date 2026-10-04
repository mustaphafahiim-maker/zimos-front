import type { ApiClient } from "../client";

/** Who answers "Import reviews" (reviews/import): a real importer, the sandbox, or none yet. */
export interface ReviewImporterInfo {
  available: boolean;
  name: string | null;
  sandbox: boolean;
}

export interface ReviewImportRequest {
  productId: string;
  /** A product page in the merchant's own Shopify store (…/products/<handle>). */
  url: string;
  photosOnly?: boolean;
  minRating?: number;
  language?: "any" | "ar" | "en" | "fr";
  /** "pending" (default) waits for approval; "approved" shows them at once. */
  status?: "approved" | "pending";
}

export interface ReviewImportResult {
  imported: number;
  duplicates: number;
  filteredOut: number;
  found: number;
  importer: { name: string; sandbox: boolean };
}

export async function reviewImporterInfo(client: ApiClient, workspaceId: string): Promise<ReviewImporterInfo> {
  const { importer } = await client.request<{ importer: ReviewImporterInfo }>(`/workspaces/${workspaceId}/reviews/import/importer`);
  return importer;
}

/** 422 REVIEW_IMPORT_BAD_LINK for a link that isn't one product page; 503 REVIEW_IMPORT_UNAVAILABLE with no importer. */
export async function reviewImportRun(client: ApiClient, workspaceId: string, body: ReviewImportRequest): Promise<ReviewImportResult> {
  const { result } = await client.request<{ result: ReviewImportResult }>(`/workspaces/${workspaceId}/reviews/import`, {
    method: "POST",
    body,
  });
  return result;
}
