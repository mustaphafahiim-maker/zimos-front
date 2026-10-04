import { useState, type FormEvent } from "react";
import { Alert, Button, Input, Label } from "@store-builder/ui";
import { ApiError, type TwoFactorChallenge } from "@store-builder/api-client";

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
  const extra = challenge as TwoFactorChallenge & { codeNotSent?: boolean; newDevice?: boolean };
  const newDevice = extra.newDevice === true;
  const [backup, setBackup] = useState(extra.codeNotSent === true && !newDevice);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = backup ? code.replace(/[^A-Z0-9]/g, "").length === 8 : code.length === 6;

  const body = extra.codeNotSent
    ? newDevice
      ? "We already sent several codes, so no new one was sent. Wait a few minutes and sign in again."
      : "We already sent several codes, so no new one was sent. Use a backup code, or wait a few minutes."
    : challenge.channel === "totp"
      ? "Enter the 6-digit code from your authenticator app."
      : `We sent a 6-digit code to ${challenge.sentTo ?? "you"}${challenge.channel === "whatsapp" ? " on WhatsApp" : challenge.channel === "sms" ? " by SMS" : ""}.`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onVerify(code.trim());
    } catch (err) {
      if (err instanceof ApiError) setError(err.status === 429 ? "Too many wrong codes. Go back and sign in again." : err.status === 401 ? "That code is not correct or has expired." : err.message);
      else setError("Can't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      {newDevice && <p className="text-sm font-medium text-ink">You are signing in from a device we don't know yet.</p>}
      <p className="text-sm text-ink-soft">{body}</p>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="space-y-1.5">
        <Label htmlFor="two-factor-code">{backup ? "Backup code" : "Code"}</Label>
        <Input
          key={backup ? "backup" : "code"}
          id="two-factor-code"
          dir="ltr"
          inputMode={backup ? "text" : "numeric"}
          autoComplete={backup ? "off" : "one-time-code"}
          autoFocus
          maxLength={backup ? 9 : 6}
          value={code}
          onChange={(e) => setCode(backup ? e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") : e.target.value.replace(/\D/g, ""))}
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
            {backup ? "Use the sign-in code instead" : "Can't get the code? Use a backup code"}
          </button>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={busy || !ready}>
        {busy ? "Checking…" : "Sign in"}
      </Button>
      <button type="button" onClick={onBack} className="block w-full text-center text-sm text-ink-soft hover:text-primary">
        Back to sign in
      </button>
    </form>
  );
}
