import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Alert, Button } from "@store-builder/ui";
import { TextField } from "@/components/Field";
import { fmt } from "@/i18n/LocaleContext";

/** Seconds left until `iso` (0 once it passed), ticking each second. */
export function useSecondsUntil(iso: string | null | undefined): number {
  const left = () => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000)) : 0);
  const [seconds, setSeconds] = useState(left);
  useEffect(() => {
    setSeconds(left());
    if (!iso) return;
    const timer = window.setInterval(() => {
      const next = left();
      setSeconds(next);
      if (next <= 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);
  return seconds;
}

/** An address or number inside a sentence, kept left to right in Arabic text. */
export const ltrText = (value: string) => `⁦${value}⁩`;

/**
 * The second half of every "we sent you a code" dialog: the sentence saying
 * where it went, the 6-digit field, Confirm, and "send a new one" that waits
 * for `resendAvailableAt` with a countdown.
 */
export function CodeEntry({
  intro,
  label,
  confirmLabel,
  busyLabel,
  resendLabel,
  /** With `{s}` for the seconds left. */
  resendWaitLabel,
  resendAvailableAt,
  error,
  busy,
  onConfirm,
  onResend,
  extra,
}: {
  intro: ReactNode;
  label: string;
  confirmLabel: string;
  busyLabel: string;
  resendLabel: string;
  resendWaitLabel: string;
  resendAvailableAt: string | null | undefined;
  error: string | null;
  busy: boolean;
  onConfirm: (code: string) => void;
  onResend: () => void;
  extra?: ReactNode;
}) {
  const [code, setCode] = useState("");
  const wait = useSecondsUntil(resendAvailableAt);

  function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (code.length === 6 && !busy) onConfirm(code);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm leading-6 text-ink">{intro}</p>
      {error && <Alert variant="danger">{error}</Alert>}
      <TextField
        label={label}
        inputMode="numeric"
        autoComplete="one-time-code"
        dir="ltr"
        maxLength={6}
        required
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
      />
      {extra}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            disabled={busy || wait > 0}
            onClick={() => {
              setCode("");
              onResend();
            }}
          >
            {resendLabel}
          </Button>
          {wait > 0 && (
            <p className="px-3 text-xs text-ink-soft tabular-nums" aria-live="off">
              {fmt(resendWaitLabel, { s: wait })}
            </p>
          )}
        </div>
        <Button type="submit" className="min-h-11" disabled={busy || code.length !== 6}>
          {busy ? busyLabel : confirmLabel}
        </Button>
      </div>
    </form>
  );
}
