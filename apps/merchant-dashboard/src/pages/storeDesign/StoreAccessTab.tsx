import { useEffect, useId, useState, type FormEvent } from "react";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { IconDevices, IconDoor, IconEye, IconEyeOff, IconHourglass, IconLock, IconShield } from "@/components/icons";
import { Button, Input, cn } from "@store-builder/ui";
import {
  storeGateGet,
  storeGateSave,
  type StoreGateMode,
  type StoreGateSettings,
  type StoreGateUpdate,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { isPermissionError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { storeUrl } from "@/lib/storeAddress";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { AccordionSection } from "@/components/Accordion";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { Field } from "@/components/Field";
import { SaveBar } from "@/components/SaveBar";
import { Select } from "@/components/Select";
import { SettingsGroup, SettingsRow, SettingsSwitch } from "@/components/settings";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ToggleRow } from "./SettingsFormFooter";
import { StoreGateSignups } from "./StoreGateSignups";
import { GroupBlock, STACK, SettingsSkeleton, TOUCH_FIELDS, TextareaRow } from "./sections/parts";

const STRINGS = {
  en: {
    title: "Store access",
    description:
      "Who can open your store while you get it ready: everyone, only people with a password, or nobody yet — with a coming-soon page that collects emails.",
    stateOff: "Open",
    statePassword: "Locked with a password",
    stateComingSoon: "Coming soon page",
    modeLegend: "Who can enter",
    off: "Open",
    offHint: "Everyone can browse and order.",
    password: "Password",
    passwordHint: "Only people you give the password to — for a private sale or while you test.",
    coming_soon: "Coming soon",
    comingSoonHint: "A page that says you open soon and collects visitors' emails.",
    passwordLabel: "Store password",
    passwordNewHint: "4 to 100 characters. Send it to whoever you want to let in.",
    passwordKeep: "A password is saved — leave this empty to keep it.",
    passwordChange: "A new password signs out everyone who entered with the old one.",
    passwordRequired: "Choose a password to lock the store with.",
    passwordShort: "The password needs at least 4 characters.",
    showPassword: "Show password",
    hidePassword: "Hide password",
    messageLabel: "Message for visitors",
    messageHint: "Optional, up to 500 characters — for example “Private sale for our customers”.",
    opensAtLabel: "Opening date",
    opensAtHint: "Optional. Visitors see a countdown to it. The store doesn't open by itself — switch it to Open when you're ready.",
    opensAtPast: "This date has passed. Visitors see “We're opening any moment now”.",
    clearDate: "Remove the date",
    lockFunnels: "Lock your sales funnels too",
    lockFunnelsHint: "Off: links to your sales funnels keep selling while the store is locked.",
    ageTitle: "Age check",
    ageEnabled: "Ask visitors their age before they enter",
    ageHint: "For stores that sell to adults only. It's the visitor's own answer — it can't be verified.",
    minAge: "Minimum age",
    ageMessage: "Note under the question",
    ageMessageHint: "Optional, up to 300 characters.",
    ageYears: "{n} years",
    ageOn: "On · {age} and over",
    ageOff: "Off",
    now: "Right now:",
    seeTitle: "What shoppers will see",
    seeOff: "Your store as usual: every page, the cart and checkout.",
    seePassword:
      "Every store page shows “This store is password protected”, your message and a password box. With the right password they shop as usual for 30 days.",
    seeComingSoon: "Every store page shows “Opening soon”, your message and “Tell me when you open” to leave their email.",
    seeCountdown: "A countdown to {date}.",
    seeStillOpen: "People who already ordered can still follow their orders, pay, download their files and open their courses and subscriptions.",
    seeFunnelsOpen: "Your sales funnel links keep selling.",
    seeFunnelsLocked: "Your sales funnel links are locked too.",
    seeAge: "Before entering, they're asked “Are you {n} or older?”.",
    seeYou: "You can still go through your store:",
    preview: "Open my store as a preview",
    previewHint: "Only you get in with this link, for 2 hours.",
    asShopper: "See it as shoppers do",
    save: "Save",
    saving: "Saving…",
    saved: "Saved.",
    unsaved: "You have unsaved changes.",
    confirmTitle: "Lock your store?",
    confirmBody:
      "Shoppers can't browse or order from your store until you switch it back to Open. People who already ordered can still follow their orders.",
    confirmLock: "Lock the store",
    confirmCancel: "Not now",
  },
  ar: {
    title: "دخول المتجر",
    description:
      "مين يقدر يفتح متجرك وانت بتجهزه: أي حد، أو اللي معاه الباسورد بس، أو محدش لسه — مع صفحة «هنفتح قريب» بتجمع إيميلات الزوار.",
    stateOff: "مفتوح",
    statePassword: "مقفول بباسورد",
    stateComingSoon: "صفحة «قريبًا»",
    modeLegend: "مين يقدر يدخل",
    off: "مفتوح",
    offHint: "أي حد يقدر يتفرج ويطلب.",
    password: "بباسورد",
    passwordHint: "اللي تديله الباسورد بس — لبيع خاص أو وانت بتجرّب.",
    coming_soon: "قريبًا",
    comingSoonHint: "صفحة بتقول إنك هتفتح قريب وبتجمع إيميلات الزوار.",
    passwordLabel: "باسورد المتجر",
    passwordNewHint: "من ٤ لـ ١٠٠ حرف. ابعته للي عايزه يدخل.",
    passwordKeep: "فيه باسورد متسجل — سيب الخانة فاضية عشان يفضل هو.",
    passwordChange: "لو غيّرت الباسورد، كل اللي دخلوا بالقديم هيطلعوا ولازم يكتبوا الجديد.",
    passwordRequired: "اختار باسورد تقفل بيه المتجر.",
    passwordShort: "الباسورد لازم يكون ٤ حروف على الأقل.",
    showPassword: "اعرض الباسورد",
    hidePassword: "اخفي الباسورد",
    messageLabel: "رسالة للزوار",
    messageHint: "اختياري، لحد ٥٠٠ حرف — مثلًا «بيع خاص لعملائنا».",
    opensAtLabel: "ميعاد الافتتاح",
    opensAtHint: "اختياري. الزوار هيشوفوا عدّاد لحد الميعاد ده. المتجر مش هيفتح لوحده — حوّله لـ«مفتوح» لما تجهز.",
    opensAtPast: "الميعاد ده عدّى. الزوار هيشوفوا «هنفتح في أي لحظة».",
    clearDate: "شيل الميعاد",
    lockFunnels: "اقفل مسارات البيع كمان",
    lockFunnelsHint: "لو مقفول: لينكات مسارات البيع بتاعتك هتفضل تبيع والمتجر مقفول.",
    ageTitle: "تأكيد السن",
    ageEnabled: "اسأل الزوار عن سنهم قبل ما يدخلوا",
    ageHint: "للمتاجر اللي بتبيع للكبار بس. ده رد الزائر نفسه — مينفعش نتأكد منه.",
    minAge: "أقل سن",
    ageMessage: "ملاحظة تحت السؤال",
    ageMessageHint: "اختياري، لحد ٣٠٠ حرف.",
    ageYears: "{n} سنة",
    ageOn: "شغّال · من {age}",
    ageOff: "مقفول",
    now: "دلوقتي:",
    seeTitle: "العميل هيشوف إيه",
    seeOff: "متجرك عادي: كل الصفحات والسلة والدفع.",
    seePassword:
      "كل صفحات المتجر هيظهر فيها «المتجر ده محمي بباسورد» ورسالتك وخانة الباسورد. ولو كتبه صح، يتسوق عادي لمدة ٣٠ يوم.",
    seeComingSoon: "كل صفحات المتجر هيظهر فيها «هنفتح قريب» ورسالتك وخانة «بلغني لما تفتحوا» يسيبوا فيها إيميلهم.",
    seeCountdown: "وعدّاد لحد {date}.",
    seeStillOpen: "اللي طلبوا قبل كده هيفضلوا يتابعوا أوردراتهم ويدفعوا وينزّلوا ملفاتهم ويدخلوا كورساتهم واشتراكاتهم.",
    seeFunnelsOpen: "لينكات مسارات البيع هتفضل تبيع.",
    seeFunnelsLocked: "لينكات مسارات البيع مقفولة كمان.",
    seeAge: "وقبل ما يدخلوا هيتسألوا «عندك {n} سنة أو أكتر؟».",
    seeYou: "انت لسه تقدر تتفرج على متجرك:",
    preview: "افتح متجرك كمعاينة",
    previewHint: "اللينك ده ليك انت بس، وشغال لمدة ساعتين.",
    asShopper: "شوفه زي العميل",
    save: "حفظ",
    saving: "بنحفظ…",
    saved: "اتحفظ.",
    unsaved: "عندك تغييرات لسه ما اتحفظتش.",
    confirmTitle: "تقفل متجرك؟",
    confirmBody: "العملاء مش هيقدروا يتفرجوا أو يطلبوا من متجرك لحد ما ترجّعه «مفتوح». اللي طلبوا قبل كده هيفضلوا يتابعوا أوردراتهم.",
    confirmLock: "اقفل المتجر",
    confirmCancel: "مش دلوقتي",
  },
} satisfies Messages;

const MODES: readonly StoreGateMode[] = ["off", "password", "coming_soon"];
const MODE_ICON = { off: IconDoor, password: IconLock, coming_soon: IconHourglass } as const;
const AGES = Array.from({ length: 13 }, (_, i) => 13 + i);
const MESSAGE_MAX = 500;
const AGE_MESSAGE_MAX = 300;

/** `datetime-local` value on the viewer's own clock for an ISO time, and back. */
function localInputOf(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function isoOfLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

interface Draft {
  mode: StoreGateMode;
  password: string;
  message: string;
  opensAt: string;
  lockFunnels: boolean;
  ageEnabled: boolean;
  minAge: number;
  ageMessage: string;
}

function draftOf(s: StoreGateSettings): Draft {
  return {
    mode: s.mode,
    password: "",
    message: s.message ?? "",
    opensAt: localInputOf(s.opensAt),
    lockFunnels: s.lockFunnels,
    ageEnabled: s.ageCheck.enabled,
    minAge: s.ageCheck.enabled ? s.ageCheck.minAge : 18,
    ageMessage: s.ageCheck.enabled ? (s.ageCheck.message ?? "") : "",
  };
}

function sameDraft(a: Draft, b: Draft): boolean {
  return (
    a.mode === b.mode &&
    a.password === b.password &&
    a.message.trim() === b.message.trim() &&
    a.opensAt === b.opensAt &&
    a.lockFunnels === b.lockFunnels &&
    a.ageEnabled === b.ageEnabled &&
    (!a.ageEnabled || (a.minAge === b.minAge && a.ageMessage.trim() === b.ageMessage.trim()))
  );
}

/**
 * Store settings → Store access (frontend-handoff 197): keep the store open,
 * behind a password, or behind a coming-soon page that collects emails; lock
 * the sales funnels too or not; ask visitors their age first. Needs
 * website.publish — without it the GET answers 403 and DataState draws the
 * no-permission card. The sign-ups list sits under it.
 */
export function StoreAccessTab() {
  const workspaceId = useWorkspaceId();
  const loaded = useAsync(() => storeGateGet(apiClient, workspaceId), [workspaceId]);
  const saved = loaded.data;

  return (
    <>
      <DataState loading={loaded.loading && !saved} error={loaded.error} onRetry={() => void loaded.refresh()} skeleton={<SettingsSkeleton />}>
        {saved && <StoreAccessForm data={saved} onSaved={loaded.setData} />}
      </DataState>
      {/* The sign-ups read their own list; without the permission the lock above already says so. */}
      {!isPermissionError(loaded.error) && <StoreGateSignups />}
    </>
  );
}

function StoreAccessForm({ data, onSaved }: { data: StoreGateSettings; onSaved: (next: StoreGateSettings) => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const ids = useId();
  const [draft, setDraft] = useState<Draft>(() => draftOf(data));
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // A save (or a reload) brings the server's view back: the password field empties.
  useEffect(() => {
    setDraft(draftOf(data));
  }, [data]);

  const base = draftOf(data);
  const dirty = !sameDraft(draft, base);
  useReportDirty(dirty);
  const locked = draft.mode !== "off";
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

  function validate(): boolean {
    if (draft.mode !== "password") return true;
    const pw = draft.password;
    if (!pw && !data.hasPassword) {
      setPasswordError(t.passwordRequired);
      return false;
    }
    if (pw && pw.length < 4) {
      setPasswordError(t.passwordShort);
      return false;
    }
    return true;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!dirty || saving) return;
    setError(null);
    if (!validate()) {
      document.getElementById(`${ids}-password`)?.focus();
      return;
    }
    // Closing an open store stops every sale: asked once, on the way in.
    if (data.mode === "off" && locked) {
      setConfirming(true);
      return;
    }
    void save();
  }

  async function save() {
    const body: StoreGateUpdate = {
      mode: draft.mode,
      ...(draft.mode === "password" && draft.password ? { password: draft.password } : {}),
      message: draft.message.trim() || null,
      opensAt: isoOfLocalInput(draft.opensAt),
      lockFunnels: draft.lockFunnels,
      ageCheck: draft.ageEnabled
        ? { enabled: true, minAge: draft.minAge, message: draft.ageMessage.trim() || null }
        : { enabled: false },
    };
    setSaving(true);
    setError(null);
    try {
      const next = await storeGateSave(apiClient, workspaceId, body);
      onSaved(next);
      setShowPassword(false);
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  }

  const opensAtIso = draft.mode === "coming_soon" ? isoOfLocalInput(draft.opensAt) : null;
  const opensAtPast = opensAtIso !== null && Date.parse(opensAtIso) <= Date.now();

  return (
    <form onSubmit={submit} noValidate className={STACK}>
      <SettingsGroup
        title={t.modeLegend}
        description={t.description}
        footer={
          <span className="flex flex-wrap items-center gap-2">
            {t.now}
            <StatusBadge
              value={data.mode}
              tone={data.mode === "off" ? "success" : data.mode === "password" ? "warning" : "info"}
              text={data.mode === "off" ? t.stateOff : data.mode === "password" ? t.statePassword : t.stateComingSoon}
            />
          </span>
        }
      >
        <GroupBlock>
          <fieldset disabled={saving}>
            <legend className="sr-only">{t.modeLegend}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {MODES.map((mode) => {
                const checked = draft.mode === mode;
                const Icon = MODE_ICON[mode];
                const hint = mode === "off" ? t.offHint : mode === "password" ? t.passwordHint : t.comingSoonHint;
                return (
                  <label
                    key={mode}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-start gap-2.5 rounded-[1rem] border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary motion-reduce:transition-none",
                      checked ? "border-primary bg-primary-soft/60" : "border-line hover:border-line-strong"
                    )}
                  >
                    <input
                      type="radio"
                      name={`${ids}-mode`}
                      className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
                      checked={checked}
                      aria-labelledby={`${ids}-${mode}`}
                      aria-describedby={`${ids}-${mode}-hint`}
                      onChange={() => {
                        set("mode", mode);
                        setPasswordError(null);
                      }}
                    />
                    <span className="min-w-0">
                      <span id={`${ids}-${mode}`} className={cn("flex items-center gap-1.5 text-sm font-medium", checked ? "text-primary-dark dark:text-primary" : "text-ink")}>
                        <Icon className="size-4 shrink-0" weight={checked ? "fill" : "regular"} aria-hidden />
                        {t[mode]}
                      </span>
                      <span id={`${ids}-${mode}-hint`} className="mt-0.5 block text-[13px] leading-5 text-ink-soft">
                        {hint}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </GroupBlock>

        {draft.mode === "password" && (
          <SettingsRow
            label={data.hasPassword ? t.passwordLabel : `${t.passwordLabel} *`}
            hint={data.hasPassword ? t.passwordKeep : t.passwordNewHint}
            htmlFor={`${ids}-password`}
            error={passwordError ?? undefined}
            control={
              <>
                {/* Left to right like the password itself, so the eye sits at the end of the typed text. */}
                <div className="relative w-full" dir="ltr">
                  <Input
                    id={`${ids}-password`}
                    type={showPassword ? "text" : "password"}
                    dir="ltr"
                    autoComplete="new-password"
                    spellCheck={false}
                    maxLength={100}
                    value={draft.password}
                    placeholder={data.hasPassword ? "••••••••" : undefined}
                    onChange={(e) => {
                      set("password", e.target.value);
                      setPasswordError(null);
                    }}
                    aria-invalid={passwordError ? true : undefined}
                    className={cn("min-h-11 pe-12 text-start", passwordError && "border-danger focus-visible:ring-danger/30")}
                    disabled={saving}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t.hidePassword : t.showPassword}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 end-0 flex w-11 cursor-pointer items-center justify-center rounded-e-[var(--radius)] text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {showPassword ? <IconEyeOff className="size-4" aria-hidden /> : <IconEye className="size-4" aria-hidden />}
                  </button>
                </div>
                {data.hasPassword && draft.password && <p className="self-stretch text-[13px] leading-5 text-accent-dark">{t.passwordChange}</p>}
              </>
            }
          />
        )}

        {locked && (
          <TextareaRow
            label={t.messageLabel}
            hint={`${t.messageHint} (${fmt("{n}/{max}", { n: draft.message.length, max: MESSAGE_MAX })})`}
            rows={3}
            dir="auto"
            maxLength={MESSAGE_MAX}
            value={draft.message}
            onChange={(e) => set("message", e.target.value)}
            disabled={saving}
          />
        )}

        {draft.mode === "coming_soon" && (
          <SettingsRow
            label={t.opensAtLabel}
            hint={opensAtPast ? t.opensAtPast : t.opensAtHint}
            htmlFor={`${ids}-opens`}
            stacked
            control={
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id={`${ids}-opens`}
                  type="datetime-local"
                  dir="ltr"
                  value={draft.opensAt}
                  onChange={(e) => set("opensAt", e.target.value)}
                  disabled={saving}
                  className="min-h-11 w-auto min-w-0 flex-1"
                />
                {draft.opensAt && (
                  <Button type="button" variant="outline" className="min-h-11 rounded-full px-4" onClick={() => set("opensAt", "")} disabled={saving}>
                    {t.clearDate}
                  </Button>
                )}
              </div>
            }
          />
        )}

        {locked && (
          <SettingsSwitch
            label={t.lockFunnels}
            hint={t.lockFunnelsHint}
            checked={draft.lockFunnels}
            disabled={saving}
            onChange={(next) => set("lockFunnels", next)}
          />
        )}
      </SettingsGroup>

      <ShopperView draft={draft} opensAtIso={opensAtPast ? null : opensAtIso} />

      {/* Used by few stores: folded, with what it is set to. Kept mounted, so a fold never drops an edit. */}
      <AccordionSection
        title={t.ageTitle}
        icon={IconShield}
        summary={draft.ageEnabled ? fmt(t.ageOn, { age: fmt(t.ageYears, { n: draft.minAge }) }) : t.ageOff}
        persistKey="store-settings:access:age"
        keepMounted
      >
        <div className={`space-y-3 ${TOUCH_FIELDS}`}>
          <ToggleRow label={t.ageEnabled} hint={t.ageHint} checked={draft.ageEnabled} disabled={saving} onChange={(next) => set("ageEnabled", next)} />
          {draft.ageEnabled && (
            <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <Field label={t.minAge}>
                {(props) => (
                  <Select {...props} value={draft.minAge} onChange={(e) => set("minAge", Number(e.target.value))} disabled={saving}>
                    {AGES.map((n) => (
                      <option key={n} value={n}>
                        {fmt(t.ageYears, { n })}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t.ageMessage} hint={`${t.ageMessageHint} (${fmt("{n}/{max}", { n: draft.ageMessage.length, max: AGE_MESSAGE_MAX })})`}>
                {(props) => (
                  <Input
                    {...props}
                    dir="auto"
                    maxLength={AGE_MESSAGE_MAX}
                    value={draft.ageMessage}
                    onChange={(e) => set("ageMessage", e.target.value)}
                    disabled={saving}
                  />
                )}
              </Field>
            </div>
          )}
        </div>
      </AccordionSection>

      {/* No onSave: inside the form the bar's button submits it — through the checks and the lock question above. */}
      <SaveBar
        dirty={dirty}
        saving={saving}
        onDiscard={() => {
          setDraft(draftOf(data));
          setPasswordError(null);
          setError(null);
          setShowPassword(false);
        }}
        saveLabel={t.save}
        savingLabel={t.saving}
        message={
          error ? (
            <span role="alert" className="text-danger">
              {error}
            </span>
          ) : undefined
        }
      />

      <ConfirmDialog
        open={confirming}
        title={t.confirmTitle}
        description={t.confirmBody}
        confirmLabel={t.confirmLock}
        cancelLabel={t.confirmCancel}
        busyLabel={t.saving}
        onCancel={() => setConfirming(false)}
        onConfirm={save}
      />
    </form>
  );
}

/** What the draft (saved or not) means for a shopper, in plain words — and the merchant's own ways in. */
function ShopperView({ draft, opensAtIso }: { draft: Draft; opensAtIso: string | null }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const slug = currentWorkspace?.slug;
  const lines: string[] = [];
  if (draft.mode === "off") lines.push(t.seeOff);
  if (draft.mode === "password") lines.push(t.seePassword);
  if (draft.mode === "coming_soon") {
    lines.push(t.seeComingSoon);
    if (opensAtIso) lines.push(fmt(t.seeCountdown, { date: formatDateTime(opensAtIso) }));
  }
  if (draft.mode !== "off") {
    lines.push(t.seeStillOpen);
    lines.push(draft.lockFunnels ? t.seeFunnelsLocked : t.seeFunnelsOpen);
  }
  if (draft.ageEnabled) lines.push(fmt(t.seeAge, { n: draft.minAge }));

  function openPreview() {
    // Opened now, while the click still counts as the user's, then pointed at the store.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    const plain = `${STOREFRONT_URL}/store/${workspaceId}`;
    apiClient
      .createStorePreviewToken(workspaceId)
      .then(({ token }) => `${plain}?storePreview=${encodeURIComponent(token)}`)
      .catch(() => plain)
      .then((target) => {
        if (tab) tab.location.href = target;
        else window.open(target, "_blank", "noopener");
      });
  }

  return (
    <div className="space-y-3 rounded-[1.25rem] bg-primary-soft px-4 py-3.5 text-sm text-primary-dark dark:text-primary" aria-live="polite">
      <p className="flex items-center gap-2 font-semibold">
        <IconDevices className="size-4 shrink-0" aria-hidden />
        {t.seeTitle}
      </p>
      <ul className="list-disc space-y-1 ps-5">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {(draft.mode !== "off" || draft.ageEnabled) && (
        <div className="space-y-2 border-t border-primary/15 pt-3">
          <p>{t.seeYou}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="min-h-11 rounded-full bg-paper-raised px-4" onClick={openPreview}>
              <IconEye className="size-4" aria-hidden />
              {t.preview}
            </Button>
            {slug && (
              <a
                href={storeUrl(slug)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center rounded-[var(--radius)] px-2 font-medium underline underline-offset-4 hover:text-ink"
              >
                {t.asShopper}
              </a>
            )}
          </div>
          <p className="text-xs">{t.previewHint}</p>
        </div>
      )}
    </div>
  );
}
