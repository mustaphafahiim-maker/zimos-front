/**
 * Large files for the digital file library, uploaded in parts straight to
 * storage (backend digital/multipartUploads.js, media/storage/MULTIPART.md):
 * the API opens the upload and signs a URL per part, the browser PUTs each
 * part there, and the API completes it. The bytes never pass through the API.
 */
import { ApiError, type ApiClient } from "../client";
import type { DigitalFile } from "./digital";

export interface DigitalMultipartUpload {
  id: string;
  name: string;
  sizeBytes: number;
  partSize: number;
  partCount: number;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/digital/files/multipart`;

export async function digitalMultipartStart(
  client: ApiClient,
  workspaceId: string,
  file: { name: string; sizeBytes: number; mimeType?: string }
): Promise<DigitalMultipartUpload> {
  const { upload } = await client.request<{ upload: DigitalMultipartUpload }>(base(workspaceId), { method: "POST", body: file });
  return upload;
}

export async function digitalMultipartSignParts(
  client: ApiClient,
  workspaceId: string,
  uploadId: string,
  partNumbers: number[]
): Promise<{ parts: { partNumber: number; url: string }[]; expiresAt: string }> {
  return client.request(`${base(workspaceId)}/${uploadId}/parts`, { method: "POST", body: { partNumbers } });
}

export async function digitalMultipartComplete(
  client: ApiClient,
  workspaceId: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[]
): Promise<DigitalFile> {
  const { file } = await client.request<{ file: DigitalFile }>(`${base(workspaceId)}/${uploadId}/complete`, { method: "POST", body: { parts } });
  return file;
}

export async function digitalMultipartAbort(client: ApiClient, workspaceId: string, uploadId: string): Promise<void> {
  await client.request<unknown>(`${base(workspaceId)}/${uploadId}`, { method: "DELETE" });
}

/** PUTs one part; the storage's ETag comes back in the header (R2 exposes it by CORS) or the sandbox's JSON body. */
async function putPart(url: string, body: Blob, signal?: AbortSignal): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { method: "PUT", body, signal });
      if (!res.ok) throw new ApiError(`Part upload failed with status ${res.status}`, res.status, "UPLOAD_PART_FAILED");
      const etag = res.headers.get("ETag") ?? ((await res.json().catch(() => null)) as { etag?: string } | null)?.etag ?? null;
      if (!etag) throw new ApiError("The storage did not return the part's ETag", 0, "UPLOAD_PART_FAILED");
      return etag;
    } catch (err) {
      if (signal?.aborted) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * The whole flow for one file: start, sign parts in batches, PUT them
 * (`concurrency` at a time, each retried twice), complete. Any failure or
 * `signal` abort aborts the upload server-side too.
 */
export async function digitalUploadLargeFile(
  client: ApiClient,
  workspaceId: string,
  file: File,
  { onProgress, signal, concurrency = 3 }: { onProgress?: (sentBytes: number, totalBytes: number) => void; signal?: AbortSignal; concurrency?: number } = {}
): Promise<DigitalFile> {
  const upload = await digitalMultipartStart(client, workspaceId, { name: file.name, sizeBytes: file.size, mimeType: file.type || undefined });
  const etags = new Map<number, string>();
  let sent = 0;
  onProgress?.(0, file.size);
  try {
    const numbers = Array.from({ length: upload.partCount }, (_, i) => i + 1);
    for (let i = 0; i < numbers.length; i += 50) {
      const { parts } = await digitalMultipartSignParts(client, workspaceId, upload.id, numbers.slice(i, i + 50));
      const queue = [...parts];
      const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          const start = (next.partNumber - 1) * upload.partSize;
          const blob = file.slice(start, Math.min(file.size, start + upload.partSize));
          etags.set(next.partNumber, await putPart(next.url, blob, signal));
          sent += blob.size;
          onProgress?.(sent, file.size);
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, parts.length) }, worker));
    }
    return await digitalMultipartComplete(
      client,
      workspaceId,
      upload.id,
      numbers.map((partNumber) => ({ partNumber, etag: etags.get(partNumber) as string }))
    );
  } catch (err) {
    await digitalMultipartAbort(client, workspaceId, upload.id).catch(() => {});
    throw err;
  }
}
