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
    title: "رموز احتياطية",
    none: "مفيش رموز احتياطية لسه. اعمل رموز واحفظها في مكان أمين: كل رمز يدخّلك مرة واحدة لو الكود موصلكش.",
    left: "فاضل {count} من 10 رموز احتياطية، اتعملت يوم {date}.",
    low: "الرموز قربت تخلص. اعمل رموز جديدة.",
    make: "اعمل رموز احتياطية",
    remake: "اعمل رموز جديدة",
    password: "كلمة السر",
    passwordHint: "عشان نتأكد إنه إنت. الرموز القديمة هتبطل تشتغل.",
    cancel: "إلغاء",
    continue: "متابعة",
    working: "بننفّذ…",
    shownOnce: "احفظ الرموز دي دلوقتي. مش هتظهر تاني، وكل رمز بيشتغل مرة واحدة.",
    copy: "نسخ",
    copied: "اتنسخت الرموز",
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
    <div className="mt-3 rounded-md border border-line p-3">
      <p className="text-sm font-medium text-ink">{t.title}</p>
      <p className="mt-0.5 text-xs text-ink-soft">
        {backupCodesCreatedAt
          ? fmt(t.left, { count: backupCodesLeft, date: new Date(backupCodesCreatedAt).toLocaleDateString() })
          : t.none}
        {backupCodesCreatedAt && backupCodesLeft <= 3 && <span className="ms-1 font-medium text-danger">{t.low}</span>}
      </p>
      <Button size="sm" variant="outline" className="mt-2" disabled={busy} onClick={start}>
        {backupCodesCreatedAt ? t.remake : t.make}
      </Button>

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
            <ul dir="ltr" className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 font-mono text-sm text-ink">
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
                className="inline-flex items-center rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:border-primary"
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
    </div>
  );
}
