import { useCallback, useEffect, useReducer, useRef } from "react";
import type { ProductMedia } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { compressImageIfNeeded, validateImageFile } from "@/lib/media";

export type UploadPhase = "preparing" | "uploading" | "error";

/** One file on its way to the product, as its tile shows it. */
export interface PendingUpload {
  id: string;
  name: string;
  /** A local picture of the file while it travels; null for something the browser cannot draw. */
  previewUrl: string | null;
  phase: UploadPhase;
  /** Why it did not upload (phase "error"). */
  error: string | null;
  /** False for a file that will never go through as it is (not an image, still over the limit). */
  retryable: boolean;
}

interface Entry extends PendingUpload {
  original: File;
  /** After the shrink-if-needed step: what is actually sent. */
  prepared: File | null;
  /** The upload's answer, held until every file chosen before this one has landed. */
  result: ProductMedia | null;
}

let nextUploadId = 1;

function previewOf(file: File): string | null {
  if (!file.type.startsWith("image/") || typeof URL.createObjectURL !== "function") return null;
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

function release(entry: Entry) {
  if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
}

/**
 * The upload queue of the photo grid. Same steps and limits as before
 * (lib/media.ts): anything over 5 MB is shrunk first, one file at a time so
 * several full-size bitmaps are never in memory together; then the file is
 * checked and sent with `apiClient.uploadMedia`, uploads running side by side.
 *
 * What changed is that each file is its own tile from the moment it is chosen:
 * preparing, uploading, or failed with the reason and a retry. Finished files
 * are handed to `onUploaded` in the order they were chosen — a quick small
 * photo waits for the larger one picked before it — so the product's photos
 * line up as the merchant selected them.
 */
export function usePhotoUploads({
  workspaceId,
  onUploaded,
}: {
  workspaceId: string;
  onUploaded: (media: ProductMedia[]) => void;
}) {
  const errorMessage = useErrorMessage();
  const queue = useRef<Entry[]>([]);
  const alive = useRef(true);
  const [, redraw] = useReducer((n: number) => n + 1, 0);

  // The queue outlives the render that started an upload: it answers through the latest props.
  const latest = useRef({ workspaceId, onUploaded, errorMessage });
  useEffect(() => {
    latest.current = { workspaceId, onUploaded, errorMessage };
  });

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      queue.current.forEach(release);
    };
  }, []);

  /** Hand over every finished file that no earlier file is still holding up; failed ones do not hold anything up. */
  const flush = useCallback(() => {
    if (!alive.current) return;
    const done: Entry[] = [];
    for (const entry of queue.current) {
      if (entry.result) done.push(entry);
      else if (entry.phase !== "error") break;
    }
    if (done.length === 0) {
      redraw();
      return;
    }
    queue.current = queue.current.filter((entry) => !done.includes(entry));
    done.forEach(release);
    redraw();
    latest.current.onUploaded(done.flatMap((entry) => (entry.result ? [entry.result] : [])));
  }, []);

  const fail = useCallback((entry: Entry, reason: string, retryable: boolean) => {
    entry.phase = "error";
    entry.error = reason;
    entry.retryable = retryable;
  }, []);

  const send = useCallback(
    async (entry: Entry) => {
      const file = entry.prepared;
      if (!file) return;
      try {
        entry.result = await apiClient.uploadMedia(latest.current.workspaceId, file);
      } catch (err) {
        fail(entry, latest.current.errorMessage(err), true);
      }
      flush();
    },
    [fail, flush]
  );

  /** Shrink, check, then send — one file after another for the shrinking, the sending in parallel. */
  const prepare = useCallback(
    async (entries: Entry[]) => {
      for (const entry of entries) {
        if (!alive.current) return;
        try {
          const prepared = await compressImageIfNeeded(entry.original);
          const problem = validateImageFile(prepared);
          if (problem) {
            fail(entry, problem, false);
          } else {
            entry.prepared = prepared;
            entry.phase = "uploading";
            void send(entry);
          }
        } catch (err) {
          fail(entry, latest.current.errorMessage(err), true);
        }
        flush();
      }
    },
    [fail, flush, send]
  );

  const add = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const entries = files.map<Entry>((file) => ({
        id: `upload-${nextUploadId++}`,
        name: file.name,
        previewUrl: previewOf(file),
        phase: "preparing",
        error: null,
        retryable: true,
        original: file,
        prepared: null,
        result: null,
      }));
      queue.current = [...queue.current, ...entries];
      redraw();
      void prepare(entries);
    },
    [prepare]
  );

  const retry = useCallback(
    (id: string) => {
      const entry = queue.current.find((e) => e.id === id);
      if (!entry || entry.phase !== "error" || !entry.retryable) return;
      entry.error = null;
      if (entry.prepared) {
        entry.phase = "uploading";
        redraw();
        void send(entry);
      } else {
        entry.phase = "preparing";
        redraw();
        void prepare([entry]);
      }
    },
    [prepare, send]
  );

  const dismiss = useCallback(
    (id: string) => {
      const entry = queue.current.find((e) => e.id === id);
      if (!entry || entry.phase !== "error") return;
      queue.current = queue.current.filter((e) => e !== entry);
      release(entry);
      flush();
    },
    [flush]
  );

  const pending: PendingUpload[] = queue.current;
  return {
    /** Every file not yet among the product's photos, in the order chosen. */
    pending,
    /** How many are still preparing or uploading: saving waits for them. */
    busy: pending.filter((entry) => entry.phase !== "error").length,
    add,
    retry,
    dismiss,
  };
}
