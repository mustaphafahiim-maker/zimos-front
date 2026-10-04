/**
 * The referral code a sign-up link carried (`/register?ref=CODE`, ZIMOS's
 * referral program), kept in this browser until the new store's billing
 * settings offer it as the code to attach. Local storage: sign-up and the
 * first store are often minutes or a verification email apart.
 */
const KEY = "zimos.signupRef";

export function rememberReferralCode(code: string | null) {
  const clean = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(clean)) return;
  try {
    localStorage.setItem(KEY, clean);
  } catch {
    // Private mode: the merchant types the code in Billing instead.
  }
}

export function recallReferralCode(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function forgetReferralCode() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing kept.
  }
}
