import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Spinner } from "@store-builder/ui";
import { emailChangeConfirm, isApiErrorCode } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { BrandPanel } from "@/components/BrandPanel";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Confirm your new email",
    confirming: "Confirming your new email…",
    success: "Your sign-in email is now {email}.",
    openSettings: "Back to your account",
    signIn: "Sign in",
    badLink: "This link isn't valid. It may be incomplete or copied wrongly.",
    expired: "This link isn't valid or has expired. Ask for the change again from your account settings.",
    taken: "Another account started using that email in the meantime.",
    failed: "Couldn't confirm the email. Try again in a moment.",
  },
  ar: {
    title: "تأكيد بريدك الجديد",
    confirming: "جارٍ تأكيد بريدك الجديد…",
    success: "أصبح بريد الدخول الخاص بك {email}.",
    openSettings: "العودة إلى حسابك",
    signIn: "تسجيل الدخول",
    badLink: "الرابط غير صالح. قد يكون ناقصًا أو نُسخ بشكل خاطئ.",
    expired: "الرابط غير صالح أو انتهت صلاحيته. اطلب التغيير مرة أخرى من إعدادات حسابك.",
    taken: "بدأ حساب آخر باستخدام هذا البريد في الأثناء.",
    failed: "تعذّر تأكيد البريد. حاول مرة أخرى بعد قليل.",
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

  return (
    <div className="flex min-h-screen">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-3xl font-medium text-ink">{t.title}</h2>
          {shown === "confirming" ? (
            <div className="mt-8 flex items-center justify-center gap-3 text-sm text-ink-soft">
              <Spinner className="size-5" />
              <span>{t.confirming}</span>
            </div>
          ) : shown === "success" ? (
            <>
              <Alert variant="success" className="mt-6">
                {fmt(t.success, { email })}
              </Alert>
              <Link to={user ? "/settings" : "/login"} className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
                {user ? t.openSettings : t.signIn}
              </Link>
            </>
          ) : (
            <>
              <Alert variant="danger" className="mt-6">
                {token ? message : t.badLink}
              </Alert>
              <Link to={user ? "/settings" : "/login"} className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
                {user ? t.openSettings : t.signIn}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
