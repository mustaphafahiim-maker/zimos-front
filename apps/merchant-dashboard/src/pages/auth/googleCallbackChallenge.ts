import type { TwoFactorChallenge } from "@store-builder/api-client";

const CHANNELS = ["email", "totp", "whatsapp", "sms"] as const;

/**
 * What the Google sign-in comes back with for an account that has two-step
 * sign-in: `?twoFactorRequired=true&challengeToken=…&channel=…[&sentTo=…][&codeNotSent=true][&newDevice=true]`,
 * the same challenge a password sign-in answers with, or null.
 */
export function googleCallbackChallenge(params: URLSearchParams): TwoFactorChallenge | null {
  const token = params.get("challengeToken");
  if (params.get("twoFactorRequired") !== "true" || !token) return null;
  const channel = CHANNELS.find((c) => c === params.get("channel")) ?? "totp";
  const challenge: TwoFactorChallenge = {
    twoFactorRequired: true,
    challengeToken: token,
    channel,
    sentTo: params.get("sentTo") ?? undefined,
  };
  if (params.get("codeNotSent") === "true") challenge.codeNotSent = true;
  if (params.get("newDevice") === "true") challenge.newDevice = true;
  return challenge;
}
