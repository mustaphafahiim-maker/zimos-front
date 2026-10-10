import { useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  twoFactorRecoveryCreateCodes,
  twoFactorRecoveryStatus,
  type TwoFactorRecoveryCodes,
  type TwoFactorRecoveryStatus,
  type TwoFactorStatus,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/Field";
import { SettingsRow } from "@/components/settings";
import { formatDate } from "@/lib/format";

/**
 * Backup codes for two-step sign-in (backend: auth/twoFactorRecovery.js):
 * ten one-time codes for when the phone or the mailbox is out of reach.
 * Shown once, right after they are made; making new ones voids the old.
 */

const STRINGS = {
  en: {
    title: "Backup codes",
    none: "No backup codes yet. Make some and keep them somewhere safe: each one signs you in once if you can't get your code.",
    left: "{count} of 10 backup codes left, made on {date}.",
    low: "Few codes left. Make new ones.",
    make: "Make backup codes",
    remake: "Make new codes",
    password: "Your password",
    passwordHint: "To confirm it is you. The old codes stop working.",
    cancel: "Cancel",
    continue: "Continue",
    working: "Working…",
    shownOnce: "Save these codes now. They won't be shown again, and each one works once.",
    copy: "Copy",
    copied: "Codes copied",
    download: "Download",
    done: "I saved them",
  },
  ar: {
    title: "الرموز الاحتياطية",
    none: "لا توجد رموز احتياطية بعد. أنشئ رموزًا واحفظها في مكان آمن: كل رمز يسجّل دخولك مرة واحدة إذا لم يصلك رمز تسجيل الدخول.",
    left: "بقي {count} من 10 رموز احتياطية، أُنشئت في {date}.",
    low: "الرموز أوشكت على النفاد. أنشئ رموزًا جديدة.",
    make: "إنشاء رموز احتياطية",
    remake: "إنشاء رموز جديدة",
    password: "كلمة المرور",
    passwordHint: "للتأكد من أنك صاحب الحساب. الرموز القديمة ستتوقف عن العمل.",
    cancel: "إلغاء",
    continue: "متابعة",
    working: "جارٍ التنفيذ…",
    shownOnce: "احفظ هذه الرموز الآن. لن تظهر مرة أخرى، وكل رمز يعمل مرة واحدة.",
    copy: "نسخ",
    copied: "تم نسخ الرموز",
    download: "تنزيل",
    done: "حفظتها",
  },
} satisfies Messages;

/** `onChanged` gets the new counts: a refetch would unmount this panel before the codes are shown. */
export function BackupCodesPanel({ status, onChanged }: { status: TwoFactorStatus; onChanged: (next: TwoFactorRecoveryStatus) => void }) {
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { backupCodesLeft, backupCodesCreatedAt } = twoFactorRecoveryStatus(status);
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<TwoFactorRecoveryCodes | null>(null);

  async function make(pass: string) {
    setBusy(true);
    setError(null);
    try {
      const created = await twoFactorRecoveryCreateCodes(apiClient, pass);
      setMade(created);
      setAsking(false);
      setPassword("");
      onChanged({ backupCodesLeft: created.codes.length, backupCodesCreatedAt: created.createdAt });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // An account without a password (Google sign-in) is not asked for one.
  function start() {
    setError(null);
    if (!status.hasPassword) void make("");
    else setAsking(true);
  }

  const text = made ? made.codes.join("\n") : "";

  return (
    <>
      <SettingsRow
        label={t.title}
        hint={backupCodesCreatedAt ? fmt(t.left, { count: backupCodesLeft, date: formatDate(backupCodesCreatedAt) }) : t.none}
        error={backupCodesCreatedAt && backupCodesLeft <= 3 ? t.low : undefined}
        control={
          <Button variant="outline" className="min-h-11" disabled={busy} onClick={start}>
            {backupCodesCreatedAt ? t.remake : t.make}
          </Button>
        }
      />

      <Modal open={asking} onClose={() => setAsking(false)} title={t.title}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void make(password);
          }}
        >
          {error && <Alert variant="danger">{error}</Alert>}
          <TextField
            label={t.password}
            hint={t.passwordHint}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAsking(false)} disabled={busy}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={busy || password === ""}>
              {busy ? t.working : t.continue}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={made !== null} onClose={() => setMade(null)} title={t.title} description={t.shownOnce}>
        {made && (
          <div className="space-y-4">
            <ul dir="ltr" className="grid grid-cols-2 gap-2 rounded-[0.875rem] bg-paper-sunken p-3 font-mono text-sm text-ink">
              {made.codes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(text);
                    toast.success(t.copied);
                  } catch {
                    /* the codes are on screen to copy by hand */
                  }
                }}
              >
                {t.copy}
              </Button>
              <a
                className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-medium text-ink hover:border-primary focus-visible:outline-2 focus-visible:outline-primary sm:min-h-9"
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(`Zimos backup codes\n\n${text}\n`)}`}
                download="zimos-backup-codes.txt"
              >
                {t.download}
              </a>
              <Button type="button" onClick={() => setMade(null)}>
                {t.done}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
