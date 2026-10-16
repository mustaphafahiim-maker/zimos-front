import { Button } from "@store-builder/ui";
import { IconWarning } from "@/components/icons";
import { apiBaseUrl } from "@/lib/apiClient";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { AUTH_SUBMIT, AuthHeading, AuthLink, GoogleMark } from "@/pages/AuthShell";

/** A refused Google sign-in says why, with a way to start again. */
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
    title: "تعذّر تسجيل الدخول بجوجل",
    generic: "حدث خطأ أثناء تسجيل الدخول بحساب جوجل. حاول مرة أخرى.",
    GOOGLE_EMAIL_UNVERIFIED: "بريد حساب جوجل هذا غير مؤكَّد. أكّده لدى جوجل، أو سجّل الدخول بالبريد الإلكتروني وكلمة المرور",
    GOOGLE_STATE_MISMATCH: "انتهت محاولة الدخول بجوجل. حاول مرة أخرى",
    GOOGLE_LOGIN_FAILED: "لم ينجح الدخول بجوجل. حاول مرة أخرى",
    ACCOUNT_SUSPENDED: "هذا الحساب موقوف",
    ACCOUNT_DELETED: "تم حذف هذا الحساب",
    retry: "حاول مرة أخرى",
    back: "العودة إلى تسجيل الدخول",
  },
} satisfies Messages;

// Trying again cannot help an account that is closed.
const NO_RETRY = new Set(["ACCOUNT_SUSPENDED", "ACCOUNT_DELETED"]);
/** The reasons that have their own sentence; any other code reads as the general one. */
const KNOWN = new Set(["GOOGLE_EMAIL_UNVERIFIED", "GOOGLE_STATE_MISMATCH", "GOOGLE_LOGIN_FAILED", "ACCOUNT_SUSPENDED", "ACCOUNT_DELETED"]);

/** The refused sign-in: why (`code` is the callback's `error`, null when there was none), try again, back. */
export function GoogleCallbackError({ code }: { code: string | null }) {
  const t = useT(STRINGS);
  const known = t as Record<string, string>;
  const body = code && KNOWN.has(code) ? known[code] : t.generic;
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
