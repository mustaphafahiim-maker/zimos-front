import { useState, type FormEvent } from "react";
import { Alert, Button, Input, Label } from "@store-builder/ui";
import { ApiError, type TwoFactorChallenge } from "@store-builder/api-client";
import { useT } from "@/i18n/LocaleContext";
import { TWO_FACTOR_STRINGS, challengeBody, cleanCode, codeReady } from "@/lib/twoFactorStrings";

/**
 * The code step of a console sign-in: two-step sign-in, or a browser new to
 * the account (backend auth/twoFactorService.js, auth/newDeviceSignIn.js).
 * A backup code works in place of the code (auth/twoFactorRecovery.js).
 */
export function TwoFactorForm({
  challenge,
  onVerify,
  onBack,
}: {
  challenge: TwoFactorChallenge;
  onVerify: (code: string) => Promise<void>;
  onBack: () => void;
}) {
  const t = useT(TWO_FACTOR_STRINGS);
  const newDevice = challenge.newDevice === true;
  const [backup, setBackup] = useState(challenge.codeNotSent === true && !newDevice);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = codeReady(code, backup);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onVerify(code.trim());
    } catch (err) {
      if (err instanceof ApiError) setError(err.status === 429 ? t.tooMany : err.status === 401 ? t.wrong : err.message);
      else setError(t.unreachable);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      {newDevice && <p className="text-sm font-medium text-ink">{t.newDevice}</p>}
      <p className="text-sm text-ink-soft">{challengeBody(t, challenge)}</p>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="space-y-1.5">
        <Label htmlFor="two-factor-code">{backup ? t.backupCode : t.code}</Label>
        <Input
          key={backup ? "backup" : "code"}
          id="two-factor-code"
          dir="ltr"
          inputMode={backup ? "text" : "numeric"}
          autoComplete={backup ? "off" : "one-time-code"}
          autoFocus
          maxLength={backup ? 9 : 6}
          value={code}
          onChange={(e) => setCode(cleanCode(e.target.value, backup))}
          className="text-center font-mono text-lg tracking-[0.3em]"
        />
        {!newDevice && (
          <button
            type="button"
            onClick={() => {
              setBackup(!backup);
              setCode("");
              setError(null);
            }}
            className="text-xs font-medium text-primary hover:underline"
          >
            {backup ? t.useCode : t.useBackup}
          </button>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={busy || !ready}>
        {busy ? t.verifying : t.verify}
      </Button>
      <button type="button" onClick={onBack} className="block w-full text-center text-sm text-ink-soft hover:text-primary">
        {t.back}
      </button>
    </form>
  );
}
