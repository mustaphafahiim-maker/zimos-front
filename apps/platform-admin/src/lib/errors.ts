import { ApiError } from "@store-builder/api-client";

export { ApiError };

/** A human message for any thrown value. */
export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return err.message || "You don't have permission to do that.";
    if (err.status === 0 || err.message === "Failed to fetch") {
      return "Can't reach the server. Check your connection and try again.";
    }
    return err.message || fallback;
  }
  if (err instanceof TypeError && /fetch/i.test(err.message)) {
    return "Can't reach the server. Check your connection and try again.";
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export function isPermissionError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403;
}
