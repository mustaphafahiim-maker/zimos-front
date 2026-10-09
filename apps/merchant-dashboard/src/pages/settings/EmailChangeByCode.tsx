import { useEffect, useState } from "react";
import { Button } from "@store-builder/ui";
import { emailChangeCancel, emailChangeGet, type EmailChangePending } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { openEmailConfirm, refreshAccountFlags, useAccountFlags, useEmailConfirmState } from "@/lib/emailConfirm";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { CodeChangeDialog } from "@/components/account/CodeChangeDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { SettingsRow } from "@/components/settings";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    change: "Change email",
    changed: "Your email is changed and you've been signed out on your other devices",
    unconfirmed: "Not confirmed",
    sendCode: "Send me a code",
    pending: "A confirmation link sent earlier to {email} still works until {until}. Changing the email with a code cancels it.",
    cancelChange: "Cancel that link",
    cancelled: "The email change was cancelled.",
    phoneChanged: "Your number is changed",
  },
  ar: {
    change: "تغيير البريد",
    changed: "اتغير بريدك، وخرجنا من حسابك على باقي الأجهزة",
    unconfirmed: "مش متأكد",
    sendCode: "ابعتلي كود",
    pending: "لينك التأكيد اللي اتبعت قبل كده على {email} لسه شغّال لحد {until}. تغيير البريد برمز بيلغيه.",
    cancelChange: "الغي اللينك ده",
    cancelled: "تغيير الإيميل اتلغى.",
    phoneChanged: "اتغير رقمك",
  },
} satisfies Messages;

/**
 * The sign-in email in "Your account" (handoff 332): the current address and
 * «تغيير البريد», which now goes by codes (CodeChangeDialog) instead of a link.
 * A link sent before the change still opens /account/email-change; while one
 * is pending it is named here, with the way to cancel it. An email not
 * confirmed yet (an account confirmed by phone only) offers its code (handoff 330).
 */
export function EmailChangeByCode({ label }: { label: string }) {
  const t = useT(STRINGS);
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const flags = useAccountFlags(apiClient, user?.id);
  const { confirmedVersion } = useEmailConfirmState();
  const [pending, setPending] = useState<EmailChangePending | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    emailChangeGet(apiClient)
      .then((res) => live && setPending(res.pending))
      .catch(() => {
        /* the row still shows the current email */
      });
    return () => {
      live = false;
    };
  }, [confirmedVersion]);

  if (!user) return null;
  const userId = user.id;

  async function cancelPending() {
    setBusy(true);
    try {
      await emailChangeCancel(apiClient);
      setPending(null);
      toast.success(t.cancelled);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SettingsRow
        label={label}
        hint={pending ? fmt(t.pending, { email: pending.newEmail, until: formatDate(pending.expiresAt) }) : undefined}
        control={
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            <bdi dir="ltr" className="min-w-0 text-sm font-medium break-all text-ink">
              {user.email}
            </bdi>
            {user.emailVerifiedAt === null && (
              <>
                <StatusBadge value="unverified" tone="warning" text={t.unconfirmed} />
                <Button type="button" variant="outline" className="min-h-11" onClick={() => openEmailConfirm()}>
                  {t.sendCode}
                </Button>
              </>
            )}
            {/* Until the server said whether the account has a password, the dialog would not know what to ask for. */}
            <Button type="button" variant="outline" className="min-h-11" disabled={!flags} onClick={() => setOpen(true)}>
              {t.change}
            </Button>
            {pending && (
              <Button type="button" variant="ghost" className="min-h-11" disabled={busy} onClick={() => void cancelPending()}>
                {t.cancelChange}
              </Button>
            )}
          </div>
        }
      />
      {open && flags && (
        <CodeChangeDialog
          kind="email"
          hasPassword={flags.hasPassword}
          onClose={() => setOpen(false)}
          onChanged={async () => {
            setOpen(false);
            // The code flow kills a pending link change.
            setPending(null);
            toast.success(t.changed);
            await refreshUser();
            void refreshAccountFlags(apiClient, userId);
          }}
        />
      )}
    </>
  );
}

/**
 * «تغيير الرقم» by SMS code (handoff 332), for PhoneVerification's row: drawn
 * only while the server has the switch on (`account.phoneChange`).
 */
export function PhoneChangeByCode({ onClose }: { onClose: () => void }) {
  const t = useT(STRINGS);
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const flags = useAccountFlags(apiClient, user?.id);
  if (!flags) return null;
  return (
    <CodeChangeDialog
      kind="phone"
      hasPassword={flags.hasPassword}
      onClose={onClose}
      onChanged={async () => {
        onClose();
        toast.success(t.phoneChanged);
        await refreshUser();
      }}
    />
  );
}

/** True while the server lets a number be changed by SMS code. */
export function usePhoneChangeByCode(): boolean {
  const { user } = useAuth();
  return useAccountFlags(apiClient, user?.id)?.phoneChange === true;
}
