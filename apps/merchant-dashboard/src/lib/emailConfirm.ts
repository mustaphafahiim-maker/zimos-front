import { useEffect, useSyncExternalStore } from "react";
import { ApiError, accountFlags, apiErrorDetails, type AccountCodeSent, type AccountFlags } from "@store-builder/api-client";

/**
 * Confirming the account's email with a 6-digit code (handoff 330).
 *
 * One dialog (components/account/EmailConfirmDialog, mounted once in App) is
 * opened from three places: the banner in the shell while the account is not
 * confirmed, the sign-up that already sent a code, and any request the server
 * refuses with 403 EMAIL_NOT_VERIFIED. lib/apiClient *holds* such a request
 * here: once the code is confirmed the same request goes out again and its
 * answer reaches the caller as if it had worked the first time (the pattern of
 * lib/goLive). Closing the dialog hands the caller the refusal it got.
 *
 * Also here: what `/auth/me` says about the account beside the user
 * (`confirmed`, `hasPassword`, `phoneChange`), read once and shared.
 */

interface Waiter {
  retry: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  error: unknown;
}

export interface EmailConfirmState {
  open: boolean;
  /** The masked address, when the caller knows it (a refusal's details.email, a sign-up's emailCode.target). */
  target: string | null;
  /** A code already on its way (sign-up): the dialog starts on it without asking for another. */
  sent: AccountCodeSent | null;
  /** A request waits to be sent again once the email is confirmed. */
  holding: boolean;
  /** Bumped on every confirmation, so screens that depend on it read again. */
  confirmedVersion: number;
}

let state: EmailConfirmState = { open: false, target: null, sent: null, holding: false, confirmedVersion: 0 };
let waiters: Waiter[] = [];
const listeners = new Set<() => void>();

function set(next: Partial<EmailConfirmState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function subscribeEmailConfirm(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getEmailConfirmState(): EmailConfirmState {
  return state;
}

export function useEmailConfirmState(): EmailConfirmState {
  return useSyncExternalStore(subscribeEmailConfirm, getEmailConfirmState);
}

/** Opens the code dialog, holding nothing. `sent`: a code that already went out. */
export function openEmailConfirm(opts: { target?: string | null; sent?: AccountCodeSent | null } = {}) {
  set({ open: true, target: opts.target ?? opts.sent?.target ?? null, sent: opts.sent?.sent ? opts.sent : null });
}

/** The masked address of a 403 EMAIL_NOT_VERIFIED, or null when the error is something else. */
export function emailNotVerified(err: unknown): { email: string | null } | null {
  if (!(err instanceof ApiError) || err.status !== 403 || (err.code as string | undefined) !== "EMAIL_NOT_VERIFIED") return null;
  return { email: apiErrorDetails<{ email?: string }>(err)?.email ?? null };
}

/** Opens the dialog for a refused request, and waits for its outcome. */
export function holdForEmailConfirm<T>(error: unknown, email: string | null, retry: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    waiters.push({ retry, resolve: resolve as (value: unknown) => void, reject, error });
    set({ open: true, target: email ?? state.target, sent: null, holding: true });
  });
}

/** The dialog is done. `confirmed`: the held requests go out again; otherwise they fail as they did. */
export function closeEmailConfirm(confirmed: boolean) {
  const held = waiters;
  waiters = [];
  if (confirmed && flags) setFlags({ ...flags, confirmed: true });
  set({ open: false, holding: false, target: null, sent: null, ...(confirmed ? { confirmedVersion: state.confirmedVersion + 1 } : {}) });
  for (const waiter of held) {
    if (confirmed) waiter.retry().then(waiter.resolve, waiter.reject);
    else waiter.reject(waiter.error);
  }
}

// A sign-up that sent its code leaves a note for the first signed-in screen (the page changes in between).
const SIGNUP_CODE_KEY = "zimos.signupEmailCode";

export function rememberSignupEmailCode(code: AccountCodeSent | null) {
  try {
    if (code?.sent) sessionStorage.setItem(SIGNUP_CODE_KEY, JSON.stringify(code));
  } catch {
    // Private mode: the banner still offers the code.
  }
}

export function takeSignupEmailCode(): AccountCodeSent | null {
  try {
    const raw = sessionStorage.getItem(SIGNUP_CODE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(SIGNUP_CODE_KEY);
    return JSON.parse(raw) as AccountCodeSent;
  } catch {
    return null;
  }
}

// Where to land after signing in or up, when the person came for something (an invite link).
const AFTER_AUTH_KEY = "zimos.afterAuth";
const AFTER_AUTH_PATHS = ["/invites"];

export function rememberAfterAuth(path: string) {
  try {
    if (AFTER_AUTH_PATHS.includes(path)) sessionStorage.setItem(AFTER_AUTH_KEY, path);
  } catch {
    // Private mode: they land on the usual page.
  }
}

export function takeAfterAuth(): string | null {
  try {
    const path = sessionStorage.getItem(AFTER_AUTH_KEY);
    if (path) sessionStorage.removeItem(AFTER_AUTH_KEY);
    return path && AFTER_AUTH_PATHS.includes(path) ? path : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ account flags --

let flags: AccountFlags | null = null;
let flagsFor: string | null = null;
let flagsLoad: Promise<void> | null = null;
const flagListeners = new Set<() => void>();

function setFlags(next: AccountFlags | null) {
  flags = next;
  for (const listener of flagListeners) listener();
}

/** Reads `/auth/me` again (after a change that moves one of the flags). */
export function refreshAccountFlags(client: Parameters<typeof accountFlags>[0], userId: string): Promise<void> {
  flagsFor = userId;
  flagsLoad = accountFlags(client)
    .then((next) => {
      if (flagsFor === userId) setFlags(next);
    })
    .catch(() => {
      // Unknown stays unknown: nothing is offered or hidden on a guess.
    });
  return flagsLoad;
}

/** What the server says about the signed-in account; null until it answered. */
export function useAccountFlags(client: Parameters<typeof accountFlags>[0], userId: string | undefined): AccountFlags | null {
  const value = useSyncExternalStore(
    (listener) => {
      flagListeners.add(listener);
      return () => flagListeners.delete(listener);
    },
    () => flags,
  );
  useEffect(() => {
    if (!userId) return;
    if (flagsFor !== userId) {
      setFlags(null);
      void refreshAccountFlags(client, userId);
    }
  }, [client, userId]);
  return userId && flagsFor === userId ? value : null;
}
