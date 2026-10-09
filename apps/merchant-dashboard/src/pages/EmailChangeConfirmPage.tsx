import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { emailChangeConfirm, isApiErrorCode } from "@store-builder/api-client";
import { IconLinkOff, IconVerified } from "@/components/icons";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { AUTH_SUBMIT, AuthBusy, AuthHeading, AuthShell } from "./AuthShell";

const STRINGS = {
  en: {
    title: "Confirming your new email",
    confirming: "One moment…",
    successTitle: "Your email is changed",
    success: "You now sign in with {email}.",
    openSettings: "Back to your account",
    signIn: "Sign in",
    failedTitle: "We couldn't change your email",
    badLink: "This link isn't valid. It may be incomplete or copied wrongly.",
    expired: "This link isn't valid or has expired. Ask for the change again from your account settings.",
    taken: "Another account started using that email in the meantime.",
    failed: "Couldn't confirm the email. Try again in a moment.",
  },
  ar: {
    title: "بنأكد إيميلك الجديد",
    confirming: "لحظة واحدة…",
    successTitle: "إيميلك اتغيّر",
    success: "دلوقتي بتدخل بـ {email}.",
    openSettings: "ارجع لحسابك",
    signIn: "ادخل",
    failedTitle: "معرفناش نغيّر إيميلك",
    badLink: "اللينك ده مش شغّال. ممكن يكون ناقص أو اتنسخ غلط.",
    expired: "اللينك ده مش شغّال أو مدته خلصت. اطلب التغيير تاني من إعدادات حسابك.",
    taken: "في حساب تاني بدأ يستخدم الإيميل ده في الوقت ده.",
    failed: "معرفناش نأكد الإيميل. جرّب تاني بعد شوية.",
  },
} satisfies Messages;

/**
 * Where the link sent to a new sign-in email lands:
 * /account/email-change?token=… (backend auth/emailChange.js). Works signed in
 * or out; signed in, the account picks up the new email at once.
 */
export function EmailChangeConfirmPage() {
  const t = useT(STRINGS);
  const [params] = useSearchParams();
  const token = params.get("token");
  const { user, refreshUser } = useAuth();
  const [state, setState] = useState<"confirming" | "success" | "error">("confirming");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (!token || handled.current) return;
    handled.current = true;
    emailChangeConfirm(apiClient, token)
      .then(async (res) => {
        setEmail(res.user.email);
        setState("success");
        if (user) await refreshUser().catch(() => undefined);
      })
      .catch((err) => {
        setState("error");
        setMessage(isApiErrorCode(err, "INVALID_EMAIL_CHANGE_TOKEN") ? t.expired : isApiErrorCode(err, "EMAIL_TAKEN") ? t.taken : t.failed);
      });
  }, [token, user, refreshUser, t]);

  const shown = token ? state : "error";
  // The sentence with the address kept left to right inside it.
  const [before, after = ""] = t.success.split("{email}");

  const wayOut = (
    <Button asChild className={`mt-6 ${AUTH_SUBMIT}`}>
      <Link to={user ? "/settings" : "/login"}>{user ? t.openSettings : t.signIn}</Link>
    </Button>
  );

  return (
    <AuthShell>
      {shown === "confirming" ? (
        <>
          <AuthHeading title={t.title} center />
          <AuthBusy className="mt-4">{t.confirming}</AuthBusy>
        </>
      ) : shown === "success" ? (
        <>
          <AuthHeading title={t.successTitle} icon={<IconVerified aria-hidden />} tone="success">
            {before}
            <bdi dir="ltr" className="font-medium break-all text-ink">
              {email}
            </bdi>
            {after}
          </AuthHeading>
          {wayOut}
        </>
      ) : (
        <>
          <AuthHeading title={t.failedTitle} icon={<IconLinkOff aria-hidden />} tone="danger">
            <span role="alert">{token ? message : t.badLink}</span>
          </AuthHeading>
          {wayOut}
        </>
      )}
    </AuthShell>
  );
}
