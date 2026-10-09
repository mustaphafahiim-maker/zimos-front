import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  securityConfirmAuthenticator,
  securityDisableTwoFactor,
  securityEnableEmailCode,
  securityForgetDevices,
  securitySetupAuthenticator,
  securityTwoFactorStatus,
  supportAccessGet,
  supportAccessGrant,
  supportAccessRevoke,
  type TwoFactorStatus,
  twoFactorEnableWhatsapp,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { IconKey } from "@/components/icons";
import { SettingsGroup, SettingsLinkRow, SettingsRow } from "@/components/settings";
import { BackupCodesPanel } from "./BackupCodesPanel";
import { PaneSkeleton } from "./sections/SettingsCard";

/**
 * Settings → «الأمان» (SPEC §17.2): two-step sign-in with its methods and
 * backup codes, the way to a new password, and letting ZIMOS support into the
 * store for a while. Where the account is signed in is its own section
 * (sections/DevicesSection.tsx).
 */

const STRINGS = {
  en: {
    twoTitle: "Two-step sign-in",
    twoHint: "After your password, a code is asked for when you sign in from a device we do not know.",
    status: "Now",
    off: "Off",
    on: "On",
    emailMode: "Code by email",
    emailModeHint: "A code is sent to your sign-in email.",
    appMode: "Authenticator app",
    appModeHint: "Google Authenticator or a similar app shows the code.",
    whatsappMode: "Code on WhatsApp",
    whatsappModeHint: "A code is sent to your verified phone.",
    use: "Use this",
    whatsappOn: "Sign-in codes now go to your phone on WhatsApp.",
    needPhone: "Verify your phone under “Profile” to get codes on WhatsApp.",
    turnOffRow: "Turn off two-step sign-in",
    turnOffHint: "You sign in with your password alone.",
    turnOff: "Turn off",
    remembered: "{count} remembered device(s) are not asked for a code.",
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
    passwordTitle: "Password",
    resetPassword: "Change your password",
    resetPasswordHint: "We email you a link to set a new one.",
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
    twoTitle: "الدخول بخطوتين",
    twoHint: "بعد كلمة السر، هيتطلب كود لما تدخل من جهاز مش معروف.",
    status: "دلوقتي",
    off: "مقفول",
    on: "شغّال",
    emailMode: "كود بالإيميل",
    emailModeHint: "الكود بيتبعت على إيميل الدخول بتاعك.",
    appMode: "تطبيق المصادقة",
    appModeHint: "Google Authenticator أو تطبيق شبهه بيطلّع الكود.",
    whatsappMode: "كود على واتساب",
    whatsappModeHint: "الكود بيتبعت على موبايلك الموثّق.",
    use: "استخدمه",
    whatsappOn: "أكواد الدخول توصل دلوقتي على واتساب موبايلك.",
    needPhone: "وثّق موبايلك من «الملف الشخصي» علشان توصلك الأكواد على واتساب.",
    turnOffRow: "اقفل الدخول بخطوتين",
    turnOffHint: "هتدخل بكلمة السر بس.",
    turnOff: "اقفله",
    remembered: "{count} جهاز محفوظ مش بيتطلب منهم كود.",
    forget: "انساهم",
    forgotten: "اتنست الأجهزة المحفوظة.",
    password: "كلمة السر",
    passwordHint: "عشان نتأكد إنه إنت.",
    continue: "كمّل",
    working: "بننفّذ…",
    cancel: "إلغاء",
    emailOn: "الدخول بخطوتين بالإيميل اشتغل.",
    appOn: "الدخول بخطوتين بالتطبيق اشتغل.",
    turnedOff: "الدخول بخطوتين اتقفل.",
    scanTitle: "جهّز تطبيق المصادقة",
    scanBody: "امسح الكود ده بـ Google Authenticator أو تطبيق شبهه، وبعدين اكتب الكود اللي من ٦ أرقام.",
    manual: "أو اكتب المفتاح ده في التطبيق:",
    code: "الكود من التطبيق",
    confirm: "شغّله",
    passwordTitle: "كلمة السر",
    resetPassword: "غيّر كلمة السر",
    resetPasswordHint: "هنبعتلك لينك على إيميلك تعمل بيه كلمة سر جديدة.",
    supportTitle: "إذن الدعم",
    supportHint: "فريق ZIMOS ميقدرش يفتح بيانات المتجر ده غير لما تسمح له. الإذن بينتهي لوحده.",
    supportOff: "الدعم ملوش أي دخول على المتجر ده.",
    supportOn: "الدعم عنده إذن لحد {when}.",
    supportUsed: "آخر استخدام {when}.",
    allow: "اسمح بالدخول",
    revoke: "اقفل الإذن دلوقتي",
    duration: "لمدة قد إيه",
    hours: "{count} ساعة",
    days: "{count} يوم",
    granted: "الدعم يقدر يفتح المتجر لحد {when}.",
    revoked: "إذن الدعم اتقفل.",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

export function SecuritySection() {
  const t = useT(STRINGS);
  return (
    <>
      <TwoStepPanel t={t} />
      {/* There is no change-password call: the way to a new password is the reset link (/forgot-password). */}
      <SettingsGroup title={t.passwordTitle}>
        <SettingsLinkRow to="/forgot-password" icon={IconKey} tone="gray" label={t.resetPassword} hint={t.resetPasswordHint} />
      </SettingsGroup>
      <SupportAccessPanel t={t} />
    </>
  );
}

// ───────────────────────────── two-step ─────────────────────────────

type Method = "email" | "totp" | "whatsapp";
type Step = { kind: "password"; next: Method | "off" } | { kind: "scan"; secret: string; qr: string | null } | null;

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
  const modeLabel: Record<TwoFactorStatus["mode"], string> = { off: t.off, email: t.emailMode, totp: t.appMode, whatsapp: t.whatsappMode };
  // The WhatsApp code goes to the verified phone (PhoneVerification in the profile).
  const { user } = useAuth();
  const phoneVerified = Boolean(user?.phone && user?.phoneVerifiedAt);

  function close() {
    setStep(null);
    setPassword("");
    setCode("");
    setError(null);
  }

  // An account without a password (Google sign-in) is not asked for one.
  function start(next: Method | "off") {
    setError(null);
    if (data && !data.hasPassword) void run(next, "");
    else setStep({ kind: "password", next });
  }

  async function run(next: Method | "off", pass: string) {
    setBusy(true);
    setError(null);
    try {
      if (next === "email") {
        status.setData(await securityEnableEmailCode(apiClient, pass));
        toast.success(t.emailOn);
        close();
      } else if (next === "whatsapp") {
        status.setData(await twoFactorEnableWhatsapp(apiClient, pass));
        toast.success(t.whatsappOn);
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
      setError(errorMessage(err));
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

  async function forget() {
    try {
      status.setData(await securityForgetDevices(apiClient));
      toast.success(t.forgotten);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  /** One method: «شغّال» on the one in use, a button on the others. */
  const methodRow = (method: Method, label: string, hint: string, blocked = false) => (
    <SettingsRow
      label={label}
      hint={hint}
      control={
        data?.mode === method ? (
          <StatusBadge value="on" tone="success" text={t.on} />
        ) : (
          <Button variant="outline" className="min-h-11" disabled={busy || blocked} onClick={() => start(method)}>
            {t.use}
          </Button>
        )
      }
    />
  );

  return (
    <>
      <DataState loading={status.loading} error={status.error} onRetry={() => void status.refresh()} skeleton={<PaneSkeleton rows={4} />}>
        {data && (
          <SettingsGroup title={t.twoTitle} description={t.twoHint}>
            <SettingsRow
              label={t.status}
              hint={data.mode !== "off" && data.rememberedDevices > 0 ? fmt(t.remembered, { count: data.rememberedDevices }) : undefined}
              control={
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <StatusBadge value={data.mode} tone={data.mode === "off" ? "neutral" : "success"} text={modeLabel[data.mode]} />
                  {data.mode !== "off" && data.rememberedDevices > 0 && (
                    <Button variant="ghost" className="min-h-11" onClick={() => void forget()}>
                      {t.forget}
                    </Button>
                  )}
                </div>
              }
            />
            {methodRow("email", t.emailMode, t.emailModeHint)}
            {/* A phone never shows a tooltip: the reason the button is held is the row's own hint. */}
            {methodRow("whatsapp", t.whatsappMode, phoneVerified || data.mode === "whatsapp" ? t.whatsappModeHint : t.needPhone, !phoneVerified)}
            {methodRow("totp", t.appMode, t.appModeHint)}
            {data.mode !== "off" && <BackupCodesPanel status={data} onChanged={(next) => status.setData({ ...data, ...next })} />}
            {data.mode !== "off" && (
              <SettingsRow
                label={t.turnOffRow}
                hint={t.turnOffHint}
                control={
                  <Button variant="ghost" className="min-h-11 text-danger hover:bg-danger-soft" disabled={busy} onClick={() => start("off")}>
                    {t.turnOff}
                  </Button>
                }
              />
            )}
          </SettingsGroup>
        )}
      </DataState>

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
            <Button type="button" variant="outline" className="min-h-11" onClick={close} disabled={busy}>
              {t.cancel}
            </Button>
            <Button type="submit" className="min-h-11" disabled={busy || password === ""}>
              {busy ? t.working : t.continue}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={step?.kind === "scan"} onClose={close} title={t.scanTitle} description={t.scanBody}>
        {step?.kind === "scan" && (
          <form className="space-y-4" onSubmit={confirm}>
            {error && <Alert variant="danger">{error}</Alert>}
            {step.qr && <img src={step.qr} alt="" className="mx-auto size-44 rounded-xl bg-white p-2 ring-1 ring-line" />}
            <p className="text-[13px] leading-5 text-ink-soft">
              {t.manual}{" "}
              <code dir="ltr" className="font-mono break-all text-ink">
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
              <Button type="button" variant="outline" className="min-h-11" onClick={close} disabled={busy}>
                {t.cancel}
              </Button>
              <Button type="submit" className="min-h-11" disabled={busy || code.length !== 6}>
                {busy ? t.working : t.confirm}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
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
    <DataState loading={state.loading} error={state.error} onRetry={() => void state.refresh()} skeleton={<PaneSkeleton rows={1} />}>
      <SettingsGroup title={t.supportTitle} description={t.supportHint}>
        <SettingsRow
          label={active ? fmt(t.supportOn, { when: formatDateTime(active.expiresAt) }) : t.supportOff}
          hint={active?.lastUsedAt ? fmt(t.supportUsed, { when: formatDateTime(active.lastUsedAt) }) : undefined}
          control={
            active ? (
              <Button
                variant="outline"
                className="min-h-11"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await supportAccessRevoke(apiClient, workspaceId);
                    toast.success(t.revoked);
                  })
                }
              >
                {busy ? t.working : t.revoke}
              </Button>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Select aria-label={t.duration} className="h-11 w-auto" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                  {durations.map((h) => (
                    <option key={h} value={h}>
                      {durationLabel(h)}
                    </option>
                  ))}
                </Select>
                <Button
                  className="min-h-11"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      const grant = await supportAccessGrant(apiClient, workspaceId, hours);
                      toast.success(fmt(t.granted, { when: formatDateTime(grant.expiresAt) }));
                    })
                  }
                >
                  {busy ? t.working : t.allow}
                </Button>
              </div>
            )
          }
        />
      </SettingsGroup>
    </DataState>
  );
}
