import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  ApiError,
  securityConfirmAuthenticator,
  securityDisableTwoFactor,
  securityEnableEmailCode,
  securityEndAllSessions,
  securityEndSession,
  securityForgetDevices,
  securityListDevices,
  securitySetupAuthenticator,
  securityTwoFactorStatus,
  supportAccessGet,
  supportAccessGrant,
  supportAccessRevoke,
  type SignedInDevice,
  type TwoFactorStatus,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";

/**
 * Settings → Security (SPEC §17.2): where the account is signed in, two-step
 * sign-in, and letting ZIMOS support into the store for a while.
 */

const STRINGS = {
  en: {
    title: "Security",
    description: "Who is signed in to your account, a second step at sign-in, and support access to this store.",
    devicesTitle: "Signed-in devices",
    devicesHint: "Every browser and app signed in to your account. End any you do not recognise.",
    thisDevice: "This device",
    unknownDevice: "Unknown device",
    on: "{browser} on {os}",
    lastActive: "Last active {when}",
    end: "End",
    endAll: "Sign out everywhere",
    endAllTitle: "Sign out everywhere?",
    endAllBody: "Every device, this one included, is signed out. You will sign in again here.",
    ended: "That device was signed out.",
    noDevices: "No other device is signed in.",
    twoTitle: "Two-step sign-in",
    twoHint: "After your password, a code is asked for when you sign in from a device we do not know.",
    off: "Off",
    emailMode: "Code by email",
    appMode: "Authenticator app",
    useEmail: "Use a code by email",
    useApp: "Use an authenticator app",
    turnOff: "Turn off",
    remembered: "{count} remembered device(s)",
    forget: "Forget them",
    forgotten: "Remembered devices were forgotten.",
    password: "Your password",
    passwordHint: "To confirm it is you.",
    continue: "Continue",
    working: "Working…",
    cancel: "Cancel",
    emailOn: "Two-step sign-in by email is on.",
    appOn: "Two-step sign-in with your app is on.",
    turnedOff: "Two-step sign-in is off.",
    scanTitle: "Set up your authenticator app",
    scanBody: "Scan this code with Google Authenticator or a similar app, then type the 6-digit code it shows.",
    manual: "Or type this key into the app:",
    code: "Code from the app",
    confirm: "Turn on",
    supportTitle: "Support access",
    supportHint: "The ZIMOS team cannot open this store's data unless you let them in. Access ends by itself.",
    supportOff: "Support has no access to this store.",
    supportOn: "Support has access until {when}.",
    supportUsed: "Last used {when}.",
    allow: "Allow access",
    revoke: "End access now",
    duration: "For how long",
    hours: "{count} hour(s)",
    days: "{count} day(s)",
    granted: "Support can open this store until {when}.",
    revoked: "Support access ended.",
  },
  ar: {
    title: "الأمان",
    description: "مين داخل على حسابك، خطوة تانية عند الدخول، وإذن الدعم للمتجر ده.",
    devicesTitle: "الأجهزة المسجّل منها الدخول",
    devicesHint: "كل متصفح وتطبيق داخل على حسابك. اقفل أي جهاز مش عارفه.",
    thisDevice: "الجهاز ده",
    unknownDevice: "جهاز غير معروف",
    on: "{browser} على {os}",
    lastActive: "آخر نشاط {when}",
    end: "إنهاء",
    endAll: "خروج من كل الأجهزة",
    endAllTitle: "خروج من كل الأجهزة؟",
    endAllBody: "كل الأجهزة، ومنها الجهاز ده، هتخرج. هتسجّل دخول تاني من هنا.",
    ended: "تم تسجيل الخروج من الجهاز ده.",
    noDevices: "مفيش جهاز تاني داخل.",
    twoTitle: "الدخول بخطوتين",
    twoHint: "بعد كلمة السر، هيتطلب كود لما تدخل من جهاز مش معروف.",
    off: "متوقف",
    emailMode: "كود بالإيميل",
    appMode: "تطبيق المصادقة",
    useEmail: "استخدم كود بالإيميل",
    useApp: "استخدم تطبيق مصادقة",
    turnOff: "إيقاف",
    remembered: "{count} جهاز محفوظ",
    forget: "انساهم",
    forgotten: "تم نسيان الأجهزة المحفوظة.",
    password: "كلمة السر",
    passwordHint: "عشان نتأكد إنه إنت.",
    continue: "متابعة",
    working: "جارٍ التنفيذ…",
    cancel: "إلغاء",
    emailOn: "الدخول بخطوتين بالإيميل اتفعّل.",
    appOn: "الدخول بخطوتين بالتطبيق اتفعّل.",
    turnedOff: "الدخول بخطوتين اتوقف.",
    scanTitle: "جهّز تطبيق المصادقة",
    scanBody: "امسح الكود ده بـ Google Authenticator أو تطبيق شبهه، وبعدين اكتب الكود اللي من ٦ أرقام.",
    manual: "أو اكتب المفتاح ده في التطبيق:",
    code: "الكود من التطبيق",
    confirm: "تفعيل",
    supportTitle: "إذن الدعم",
    supportHint: "فريق ZIMOS ميقدرش يفتح بيانات المتجر ده غير لما تسمح له. الإذن بينتهي لوحده.",
    supportOff: "الدعم ملوش أي دخول على المتجر ده.",
    supportOn: "الدعم عنده إذن لحد {when}.",
    supportUsed: "آخر استخدام {when}.",
    allow: "اسمح بالدخول",
    revoke: "إنهاء الإذن دلوقتي",
    duration: "لمدة قد إيه",
    hours: "{count} ساعة",
    days: "{count} يوم",
    granted: "الدعم يقدر يفتح المتجر لحد {when}.",
    revoked: "إذن الدعم انتهى.",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;
const when = (iso: string) => new Date(iso).toLocaleString();

export function SecuritySection() {
  const t = useT(STRINGS);
  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
      <div className="mt-5 space-y-8">
        <TwoStepPanel t={t} />
        <DevicesPanel t={t} />
        <SupportAccessPanel t={t} />
      </div>
    </section>
  );
}

// ───────────────────────────── devices ─────────────────────────────

function DevicesPanel({ t }: { t: T }) {
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const devices = useAsync(() => securityListDevices(apiClient), []);
  const [ending, setEnding] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const label = (device: SignedInDevice) =>
    device.browser && device.os ? fmt(t.on, { browser: device.browser, os: device.os }) : device.browser ?? device.os ?? t.unknownDevice;

  async function end(device: SignedInDevice) {
    setEnding(device.id);
    try {
      await securityEndSession(apiClient, device.id);
      toast.success(t.ended);
      await devices.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setEnding(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-ink">{t.devicesTitle}</h3>
          <p className="text-sm text-ink-soft">{t.devicesHint}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setConfirmAll(true)}>
          {t.endAll}
        </Button>
      </div>
      <div className="mt-3">
        <DataState
          loading={devices.loading}
          error={devices.error}
          empty={(devices.data ?? []).length === 0}
          emptyMessage={t.noDevices}
          onRetry={() => void devices.refresh()}
        >
          <ul className="divide-y divide-line rounded-md border border-line">
            {(devices.data ?? []).map((device) => (
              <li key={device.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                    {label(device)}
                    {device.isCurrent && <StatusBadge value="current" tone="success" text={t.thisDevice} />}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {fmt(t.lastActive, { when: when(device.lastActiveAt) })}
                    {device.ipAddress ? (
                      <>
                        {" · "}
                        <span dir="ltr">{device.ipAddress}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                {!device.isCurrent && (
                  <Button size="sm" variant="outline" disabled={ending === device.id} onClick={() => end(device)}>
                    {ending === device.id ? t.working : t.end}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </DataState>
      </div>
      <ConfirmDialog
        open={confirmAll}
        title={t.endAllTitle}
        description={t.endAllBody}
        confirmLabel={t.endAll}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        destructive
        onCancel={() => setConfirmAll(false)}
        onConfirm={async () => {
          try {
            await securityEndAllSessions(apiClient);
          } catch (err) {
            throw new Error(errorMessage(err));
          }
          apiClient.clearSession();
          window.location.href = "/login";
        }}
      />
    </div>
  );
}

// ───────────────────────────── two-step ─────────────────────────────

type Step = { kind: "password"; next: "email" | "totp" | "off" } | { kind: "scan"; secret: string; qr: string | null } | null;

function TwoStepPanel({ t }: { t: T }) {
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const status = useAsync(() => securityTwoFactorStatus(apiClient), []);
  const [step, setStep] = useState<Step>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = status.data;
  const modeLabel: Record<TwoFactorStatus["mode"], string> = { off: t.off, email: t.emailMode, totp: t.appMode };

  function close() {
    setStep(null);
    setPassword("");
    setCode("");
    setError(null);
  }

  // An account without a password (Google sign-in) is not asked for one.
  function start(next: "email" | "totp" | "off") {
    setError(null);
    if (data && !data.hasPassword) void run(next, "");
    else setStep({ kind: "password", next });
  }

  async function run(next: "email" | "totp" | "off", pass: string) {
    setBusy(true);
    setError(null);
    try {
      if (next === "email") {
        status.setData(await securityEnableEmailCode(apiClient, pass));
        toast.success(t.emailOn);
        close();
      } else if (next === "off") {
        status.setData(await securityDisableTwoFactor(apiClient, pass));
        toast.success(t.turnedOff);
        close();
      } else {
        const setup = await securitySetupAuthenticator(apiClient, pass);
        setPassword("");
        setStep({ kind: "scan", secret: setup.secret, qr: setup.qrDataUrl });
      }
    } catch (err) {
      // A wrong password comes back as a field problem (422).
      setError(err instanceof ApiError && err.status === 422 ? errorMessage(err) : errorMessage(err));
      if (!step) toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      status.setData(await securityConfirmAuthenticator(apiClient, code.trim()));
      toast.success(t.appOn);
      close();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 className="font-medium text-ink">{t.twoTitle}</h3>
      <p className="text-sm text-ink-soft">{t.twoHint}</p>
      <div className="mt-3">
        <DataState loading={status.loading} error={status.error} onRetry={() => void status.refresh()}>
          {data && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-line p-3">
              <StatusBadge value={data.mode} tone={data.mode === "off" ? "neutral" : "success"} text={modeLabel[data.mode]} />
              {data.mode !== "off" && data.rememberedDevices > 0 && (
                <span className="text-xs text-ink-soft">
                  {fmt(t.remembered, { count: data.rememberedDevices })}{" "}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={async () => {
                      try {
                        status.setData(await securityForgetDevices(apiClient));
                        toast.success(t.forgotten);
                      } catch (err) {
                        toast.error(errorMessage(err));
                      }
                    }}
                  >
                    {t.forget}
                  </button>
                </span>
              )}
              <div className="ms-auto flex flex-wrap gap-2">
                {data.mode !== "email" && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => start("email")}>
                    {t.useEmail}
                  </Button>
                )}
                {data.mode !== "totp" && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => start("totp")}>
                    {t.useApp}
                  </Button>
                )}
                {data.mode !== "off" && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => start("off")}>
                    {t.turnOff}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DataState>
      </div>

      <Modal open={step?.kind === "password"} onClose={close} title={t.twoTitle}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (step?.kind === "password") void run(step.next, password);
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
            <Button type="button" variant="outline" onClick={close} disabled={busy}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={busy || password === ""}>
              {busy ? t.working : t.continue}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={step?.kind === "scan"} onClose={close} title={t.scanTitle} description={t.scanBody}>
        {step?.kind === "scan" && (
          <form className="space-y-4" onSubmit={confirm}>
            {error && <Alert variant="danger">{error}</Alert>}
            {step.qr && <img src={step.qr} alt="" className="mx-auto size-44 rounded-md border border-line bg-white p-2" />}
            <p className="text-xs text-ink-soft">
              {t.manual}{" "}
              <code dir="ltr" className="break-all font-mono text-ink">
                {step.secret}
              </code>
            </p>
            <TextField
              label={t.code}
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={close} disabled={busy}>
                {t.cancel}
              </Button>
              <Button type="submit" disabled={busy || code.length !== 6}>
                {busy ? t.working : t.confirm}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

// ───────────────────────────── support access ─────────────────────────────

function SupportAccessPanel({ t }: { t: T }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const state = useAsync(() => supportAccessGet(apiClient, workspaceId), [workspaceId]);
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);

  const active = state.data?.active ?? null;
  const durations = state.data?.durations ?? [];
  const durationLabel = (h: number) => (h < 24 ? fmt(t.hours, { count: h }) : fmt(t.days, { count: h / 24 }));

  async function act(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
      await state.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 className="font-medium text-ink">{t.supportTitle}</h3>
      <p className="text-sm text-ink-soft">{t.supportHint}</p>
      <div className="mt-3">
        <DataState loading={state.loading} error={state.error} onRetry={() => void state.refresh()}>
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-line p-3">
            <p className="min-w-0 flex-1 text-sm text-ink">
              {active ? fmt(t.supportOn, { when: when(active.expiresAt) }) : t.supportOff}
              {active?.lastUsedAt && <span className="block text-xs text-ink-soft">{fmt(t.supportUsed, { when: when(active.lastUsedAt) })}</span>}
            </p>
            {active ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await supportAccessRevoke(apiClient, workspaceId);
                    toast.success(t.revoked);
                  })
                }
              >
                {busy ? t.working : t.revoke}
              </Button>
            ) : (
              <>
                <Select aria-label={t.duration} className="h-9 w-auto" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                  {durations.map((h) => (
                    <option key={h} value={h}>
                      {durationLabel(h)}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      const grant = await supportAccessGrant(apiClient, workspaceId, hours);
                      toast.success(fmt(t.granted, { when: when(grant.expiresAt) }));
                    })
                  }
                >
                  {busy ? t.working : t.allow}
                </Button>
              </>
            )}
          </div>
        </DataState>
      </div>
    </div>
  );
}
