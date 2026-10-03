/**
 * The username rules, as the backend applies them (modules/users/username.js):
 * 3–30 of a–z, 0–9, "_" and "."; starts with a letter; no ".."; does not end
 * with "_" or ".". Checked here first so an obviously invalid name never
 * costs a (rate-limited) availability call. The reserved list and uniqueness
 * are the server's to judge.
 */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
const PATTERN = /^[a-z][a-z0-9._]{1,28}[a-z0-9]$/;

export type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "reserved" | "current" | "busy" | "failed";

/** A name that may be submitted: free, or the account's own, or unknown (the server decides). */
export const usernameSubmittable = (status: UsernameStatus) =>
  status === "available" || status === "current" || status === "failed" || status === "busy";

/** The stored form: trimmed and lower-cased. */
export const normalizeUsername = (value: string) => value.trim().toLowerCase();

export function isUsernameFormatValid(value: string): boolean {
  const name = normalizeUsername(value);
  return name.length >= USERNAME_MIN && name.length <= USERNAME_MAX && PATTERN.test(name) && !name.includes("..");
}
