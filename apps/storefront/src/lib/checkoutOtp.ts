import { ApiError, apiErrorDetails, type CheckoutOtpChallenge } from "@store-builder/api-client";

/**
 * Phone verification at checkout, shopper side (backend: modules/risk/checkoutOtp).
 *
 * A checkout the store wants verified answers 428 OTP_REQUIRED and sends a
 * code. `withCheckoutOtp` wraps any checkout call: on that answer it asks the
 * <OtpGate> mounted in the store layout for the code, and submits the same
 * order again with the proof. The forms themselves do not change.
 */

export interface OtpPromptRequest {
  workspaceId: string;
  phone: string;
  challenge: CheckoutOtpChallenge;
}

/** Resolves with the `otpToken`, or null when the shopper backs out to change the number. */
type OtpPrompt = (request: OtpPromptRequest) => Promise<string | null>;

let prompt: OtpPrompt | null = null;
let cancelledMessage = "The order was not placed: the phone number was not verified.";

/** <OtpGate> registers itself here (and its copy for a cancelled verification). */
export function registerOtpPrompt(next: OtpPrompt | null, message?: string) {
  prompt = next;
  if (message) cancelledMessage = message;
}

let closedBecause: string | null = null;

/** <OtpGate> closing the step for a reason of its own: the order's error line says this instead of "not verified". */
export function closeOtpStepBecause(message: string) {
  closedBecause = message;
}

export interface VerifiedPhone {
  workspaceId: string;
  phone: string;
  otpToken: string;
}

const verifiedListeners = new Set<(verified: VerifiedPhone) => void>();

/** The last proof, kept for this page's life: an order refused after the code step (a deposit asked for, handoff 362) is placed again without a second code. */
let lastVerified: (VerifiedPhone & { at: number }) | null = null;
const PROOF_KEPT_MS = 25 * 60 * 1000;

function proofFor(workspaceId: string, phone: string): string | undefined {
  if (!lastVerified || lastVerified.workspaceId !== workspaceId || lastVerified.phone !== phone) return undefined;
  return Date.now() - lastVerified.at < PROOF_KEPT_MS ? lastVerified.otpToken : undefined;
}

/** Hears each phone the code step verifies, with its `otpToken` (valid 30 minutes). Returns the unsubscribe. */
export function onPhoneVerified(listener: (verified: VerifiedPhone) => void): () => void {
  verifiedListeners.add(listener);
  return () => {
    verifiedListeners.delete(listener);
  };
}

function challengeOf(err: unknown): CheckoutOtpChallenge | null {
  if (!(err instanceof ApiError) || (err.code as string) !== "OTP_REQUIRED") return null;
  const details = apiErrorDetails<Partial<CheckoutOtpChallenge>>(err) ?? {};
  return {
    channel: details.channel === "sms" ? "sms" : "whatsapp",
    codeLength: typeof details.codeLength === "number" ? details.codeLength : 4,
    resendAfterSeconds: typeof details.resendAfterSeconds === "number" ? details.resendAfterSeconds : 60,
    phoneHint: typeof details.phoneHint === "string" ? details.phoneHint : "",
  };
}

/**
 * Runs `submit`; if the store asks for a code, collects it and runs `submit`
 * again with `{ otpToken }` to merge into the checkout body.
 */
export async function withCheckoutOtp<T>(
  workspaceId: string,
  phone: string,
  submit: (extra: { otpToken?: string }) => Promise<T>
): Promise<T> {
  const proof = proofFor(workspaceId, phone);
  try {
    return await submit(proof ? { otpToken: proof } : {});
  } catch (err) {
    // A proof the store no longer takes is not sent again.
    if (proof && err instanceof ApiError && String(err.code ?? "").startsWith("OTP_")) lastVerified = null;
    const challenge = challengeOf(err);
    if (!challenge || !prompt) throw err;
    closedBecause = null;
    const otpToken = await prompt({ workspaceId, phone, challenge });
    // Closed by the step itself (the store sent this phone no code lately, handoff 348): its own sentence, not "not verified".
    if (!otpToken) throw new Error(closedBecause ?? cancelledMessage);
    // The proof for this phone: the deposit quote is asked again with it (handoff 362; components/checkout/useCheckoutDeposit).
    lastVerified = { workspaceId, phone, otpToken, at: Date.now() };
    for (const heard of verifiedListeners) heard({ workspaceId, phone, otpToken });
    return submit({ otpToken });
  }
}
