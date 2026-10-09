import { Button } from "@store-builder/ui";
import type { TwoFactorChallenge } from "@store-builder/api-client";
import { IconWarning } from "@/components/icons";
import { apiBaseUrl } from "@/lib/apiClient";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { AUTH_SUBMIT, AuthHeading, AuthLink, GoogleMark } from "@/pages/AuthShell";

/**
 * What the Google sign-in can come back with beside a session (handoff 347, 330):
 * an account with two-step sign-in gets a challenge to finish with its code,
 * and a refused sign-in says why, with a way to start again.
 */

const STRINGS = {
  en: {
    title: "Couldn't sign in with Google",
    generic: "Something went wrong while signing in with your Google account. Try again.",
    GOOGLE_EMAIL_UNVERIFIED: "This Google account's email isn't verified. Verify it with Google, or sign in with your email and password",
    GOOGLE_STATE_MISMATCH: "The Google sign-in expired. Please try again",
    GOOGLE_LOGIN_FAILED: "Google sign-in didn't work. Please try again",
    ACCOUNT_SUSPENDED: "This account has been suspended",
    ACCOUNT_DELETED: "This account was deleted",
    retry: "Try again",
    back: "Back to sign in",
  },
  ar: {
    title: "معرفناش ندخّلك بجوجل",
    generic: "حصلت مشكلة وإحنا بندخّلك بحساب جوجل. جرّب تاني.",
    GOOGLE_EMAIL_UNVERIFIED: "إيميل حساب جوجل ده مش متأكد. أكّده عند جوجل أو ادخل بالإيميل وكلمة السر",
    GOOGLE_STATE_MISMATCH: "انتهت محاولة الدخول بجوجل. جرّب تاني",
    GOOGLE_LOGIN_FAILED: "الدخول بجوجل منجحش. جرّب تاني",
    ACCOUNT_SUSPENDED: "الحساب ده موقوف",
    ACCOUNT_DELETED: "الحساب ده اتمسح",
    retry: "جرّب تاني",
    back: "ارجع لتسجيل الدخول",
  },
} satisfies Messages;

// Trying again cannot help an account that is closed.
const NO_RETRY = new Set(["ACCOUNT_SUSPENDED", "ACCOUNT_DELETED"]);

const CHANNELS = ["email", "totp", "whatsapp", "sms"] as const;

/**
 * `?twoFactorRequired=true&challengeToken=…&channel=…[&sentTo=…][&codeNotSent=true]`:
 * the same challenge a password sign-in answers with, or null.
 */
export function googleCallbackChallenge(params: URLSearchParams): TwoFactorChallenge | null {
  const token = params.get("challengeToken");
  if (params.get("twoFactorRequired") !== "true" || !token) return null;
  const channel = CHANNELS.find((c) => c === params.get("channel")) ?? "totp";
  const challenge: TwoFactorChallenge & { codeNotSent?: boolean } = {
    twoFactorRequired: true,
    challengeToken: token,
    channel,
    sentTo: params.get("sentTo") ?? undefined,
  };
  if (params.get("codeNotSent") === "true") challenge.codeNotSent = true;
  return challenge;
}

/** The refused sign-in: why (`code` is the callback's `error`, null when there was none), try again, back. */
export function GoogleCallbackError({ code }: { code: string | null }) {
  const t = useT(STRINGS);
  const known = t as Record<string, string>;
  const body = code && code in STRINGS.en && code !== "title" ? known[code] : t.generic;
  const retry = !code || !NO_RETRY.has(code);
  return (
    <>
      <AuthHeading title={t.title} icon={<IconWarning aria-hidden />} tone="danger">
        <span role="alert">{body}</span>
      </AuthHeading>
      {retry && (
        <Button
          type="button"
          variant="outline"
          className={`mt-6 ${AUTH_SUBMIT}`}
          onClick={() => {
            // A full-page visit: the sign-in must start and finish in this browser.
            window.location.href = `${apiBaseUrl}/auth/google`;
          }}
        >
          <GoogleMark />
          {t.retry}
        </Button>
      )}
      <AuthLink to="/login" back className="mt-4">
        {t.back}
      </AuthLink>
    </>
  );
}
