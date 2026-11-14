import { ApiError, apiErrorDetails, type VerificationSent } from "@store-builder/api-client";

/**
 * Confirming the account's email from inside the dashboard. Until it is
 * confirmed (by email or phone), the backend refuses starting a trial and
 * putting anything live — publishing or restoring the website or a funnel,
 * resuming a funnel — with 403 EMAIL_NOT_VERIFIED.
 *
 * Same idea as lib/goLive: lib/apiClient routes every such refusal here and
 * *holds* the caller's request while ConfirmEmailDialog asks for the code.
 * Once it is confirmed the request is sent again and its answer handed back
 * as if it had worked the first time, so a publish goes through without a
 * reload and nothing typed in the editor is lost. Closing the dialog hands
 * the caller the original refusal. The banner opens the same dialog with
 * nothing held.
 *
 * A confirmation is also announced to the other tabs (BroadcastChannel), so
 * their banners go away too; AuthContext re-reads /auth/me on that, on focus,
 * and every minute while unconfirmed (a confirmation on another device).
 */

export interface EmailRefusal {
  /** Masked, from the refusal: "a***@gmail.com". */
  email: string | null;
}

export function emailRefusal(err: unknown): EmailRefusal | null {
  if (!(err instanceof ApiError) || err.status !== 403 || err.code !== "EMAIL_NOT_VERIFIED") return null;
  return { email: apiErrorDetails<{ email?: string | null }>(err)?.email ?? null };
}

/** The code the sign-up just sent, so the dialog can say so instead of offering to send one. */
export type SentCode = Pick<VerificationSent, "target" | "expiresAt" | "resendAvailableAt">;

interface Waiter {
  retry: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  error: unknown;
}

export interface EmailConfirmState {
  open: boolean;
  /** A request is waiting to be sent again once the email is confirmed. */
  holding: boolean;
  /** The last code sent, while it can still be used. */
  sent: SentCode | null;
  /** Bumped on every confirmation, so screens reading the account refresh. */
  confirmedVersion: number;
}

let state: EmailConfirmState = { open: false, holding: false, sent: null, confirmedVersion: 0 };
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

/** Notes a code that went out (at sign-up, or from the dialog). */
export function noteCodeSent(sent: SentCode | null) {
  set({ sent });
}

/** Opens the dialog (from the banner), holding nothing. */
export function openEmailConfirm() {
  set({ open: true });
}

/** Opens the dialog for a refused request, and waits for its outcome. */
export function holdForEmailConfirm<T>(error: unknown, retry: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    waiters.push({ retry, resolve: resolve as (value: unknown) => void, reject, error });
    set({ open: true, holding: true });
  });
}

const CHANNEL = "zimos:email-confirmed";

/**
 * The dialog is done. `confirmed`: the held requests go out again and the
 * other tabs are told; otherwise they fail with the refusal they got.
 */
export function closeEmailConfirm(confirmed: boolean) {
  const held = waiters;
  waiters = [];
  set({
    open: false,
    holding: false,
    ...(confirmed ? { sent: null, confirmedVersion: state.confirmedVersion + 1 } : {}),
  });
  if (confirmed) announceConfirmed();
  for (const waiter of held) {
    if (confirmed) waiter.retry().then(waiter.resolve, waiter.reject);
    else waiter.reject(waiter.error);
  }
}

function announceConfirmed() {
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage("confirmed");
    channel.close();
  } catch {
    // No BroadcastChannel: the other tabs notice on focus or within a minute.
  }
}

/** Calls `onConfirmed` when another tab confirms the email. Returns the unsubscribe. */
export function listenForConfirmation(onConfirmed: () => void): () => void {
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => onConfirmed();
    return () => channel.close();
  } catch {
    return () => {};
  }
}

/** a***@example.com, as the backend masks it. */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}
