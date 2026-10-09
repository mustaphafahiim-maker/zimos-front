import { ApiError, type ApiClient } from "@store-builder/api-client";
import { primeBotGuard } from "./botGuard";
import { checkoutRefusalText } from "./checkoutRefusals";
import type { Locale } from "./i18n";

/**
 * The bot guard's token for the store's sign-ups — the newsletter form
 * (footer and popup) and spin to win (frontend-handoff 363). The same time
 * token the checkout sends (GET /checkout/guard, held by lib/botGuard and
 * primed when a store page opens), sent no sooner than `minSeconds` after it
 * was issued: a fast shopper is waited out, never refused. With the guard off,
 * or when it cannot be read, nothing is sent and the server decides. The
 * form's own hidden `website` field stays the honeypot.
 */
export async function signupGuardFields(client: ApiClient, workspaceId: string): Promise<{ botToken?: string }> {
  const held = await primeBotGuard(client, workspaceId);
  if (!held || !held.guard.enabled || !held.guard.token) return {};
  const wait = held.guard.minSeconds * 1000 + 300 - (Date.now() - held.fetchedAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  return { botToken: held.guard.token };
}

/** Over 6 sign-ups a minute from one address (429 RATE_LIMITED): «محاولات كتير، جرّب تاني بعد دقيقة»; null for any other error. */
export function signupTooMany(err: unknown, locale: Locale): string | null {
  const limited = err instanceof ApiError && (err.status === 429 || String(err.code ?? "") === "RATE_LIMITED");
  return limited ? checkoutRefusalText(locale).tooMany : null;
}
