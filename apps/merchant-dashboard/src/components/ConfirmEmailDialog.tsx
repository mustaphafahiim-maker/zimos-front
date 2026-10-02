import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { MailCheck, X } from "lucide-react";
import type { VerificationChallenge } from "@store-builder/api-client";
import { VerifyCodePanel } from "@/components/VerifyCodePanel";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { useT, type Messages } from "@/i18n/LocaleContext";
import {
  closeEmailConfirm,
  getEmailConfirmState,
  maskEmail,
  noteCodeSent,
  subscribeEmailConfirm,
  type SentCode,
} from "@/lib/emailConfirm";

const STRINGS = {
  en: {
    title: "Confirm your email",
    intro: "Confirm your email address to start a free trial and publish your store. Everything else works as usual.",
    held: "Confirm your email address first. Your work is saved; it carries on as soon as the code is confirmed.",
    close: "Close",
    confirmed: "Your email is confirmed.",
  },
  ar: {
    title: "تأكيد البريد الإلكتروني",
    intro: "أكّد بريدك الإلكتروني لتتمكن من بدء الفترة التجريبية المجانية ونشر متجرك. باقي لوحة التحكم يعمل كالمعتاد.",
    held: "أكّد بريدك الإلكتروني أولًا. عملك محفوظ، وسيكتمل ما طلبته بمجرد تأكيد الرمز.",
    close: "إغلاق",
    confirmed: "تم تأكيد بريدك الإلكتروني.",
  },
} satisfies Messages;

/**
 * The code dialog for an account whose email isn't confirmed yet
 * (lib/emailConfirm opens it — from the banner, or when publishing or
 * starting a trial was refused). Above the subscribe dialog, which can be the
 * one whose trial was refused.
 */
export function ConfirmEmailDialog() {
  const state = useSyncExternalStore(subscribeEmailConfirm, getEmailConfirmState);
  const { user } = useAuth();
  if (!state.open || !user) return null;
  return <ConfirmEmailPanel email={user.email} holding={state.holding} sent={state.sent} />;
}

function stillUsable(sent: SentCode | null): SentCode | null {
  return sent && new Date(sent.expiresAt).getTime() > Date.now() ? sent : null;
}

function ConfirmEmailPanel({ email, holding, sent }: { email: string; holding: boolean; sent: SentCode | null }) {
  const t = useT(STRINGS);
  const toast = useToast();
  const { refreshUser } = useAuth();
  const titleId = useId();
  const live = stillUsable(sent);

  // Built once per opening: the panel keeps its own state from here on.
  const [challenge] = useState<VerificationChallenge>(() => ({
    verificationRequired: true,
    verificationToken: "",
    channels: ["email"],
    targets: { email: live?.target ?? maskEmail(email) },
    codeSent: Boolean(live),
    channel: "email",
    expiresAt: live?.expiresAt ?? null,
    resendAvailableAt: live?.resendAvailableAt ?? null,
  }));

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeEmailConfirm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink/40 p-4 py-8 sm:py-12"
      onMouseDown={() => closeEmailConfirm(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-[var(--radius-card)] border border-line bg-paper-raised shadow-xl outline-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <MailCheck className="size-4" aria-hidden />
          </span>
          <div className="flex-1">
            <h2 id={titleId} className="font-display text-lg font-medium text-ink">
              {t.title}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">{holding ? t.held : t.intro}</p>
          </div>
          <button
            type="button"
            onClick={() => closeEmailConfirm(false)}
            aria-label={t.close}
            className="-me-2 -mt-1 flex size-11 cursor-pointer items-center justify-center rounded-md text-ink-soft hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="px-5 py-4">
          <VerifyCodePanel
            session
            compact
            challenge={challenge}
            onSent={(next) => noteCodeSent({ target: next.target, expiresAt: next.expiresAt, resendAvailableAt: next.resendAvailableAt })}
            onVerified={async () => {
              await refreshUser();
              toast.success(t.confirmed);
              closeEmailConfirm(true);
            }}
          />
        </div>
      </div>
    </div>
  );
}
