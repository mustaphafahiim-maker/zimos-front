import { useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import { apiErrorDetails, isApiErrorCode } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { normalizeUsername, usernameSubmittable, type UsernameStatus } from "@/lib/username";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { CopyButton } from "@/components/CopyButton";
import { UsernameField } from "@/components/UsernameField";
import { useToast } from "@/components/Toast";
import { PhoneVerification } from "./PhoneVerification";
import { ProfileEditor } from "./ProfileEditor";
import { EmailChange } from "./EmailChange";

/** How often a username may be changed (the backend's CHANGE_INTERVAL_DAYS). */
const CHANGE_INTERVAL_DAYS = 30;

const STRINGS = {
  en: {
    title: "Your account",
    description: "Your sign-in details. These belong to you, not to the store.",
    name: "Name",
    email: "Email",
    id: "Account ID",
    idHint: "Support may ask for it to find your account.",
    copyId: "Copy ID",
    save: "Save username",
    saving: "Saving…",
    rule: "You can change your username once every 30 days.",
    nextChange: "You changed your username recently. You can change it again on {date}.",
    saved: "Username saved.",
    taken: "Someone just took this username. Choose another one.",
    chooseAvailable: "Choose an available username first.",
  },
  ar: {
    title: "حسابك",
    description: "بيانات دخولك. هذه البيانات تخصك أنت، لا المتجر.",
    name: "الاسم",
    email: "البريد الإلكتروني",
    id: "معرّف الحساب",
    idHint: "قد يطلبه فريق الدعم للعثور على حسابك.",
    copyId: "نسخ المعرّف",
    save: "حفظ اسم المستخدم",
    saving: "جارٍ الحفظ…",
    rule: "يمكنك تغيير اسم المستخدم مرة واحدة كل 30 يومًا.",
    nextChange: "غيّرت اسم المستخدم مؤخرًا. يمكنك تغييره مرة أخرى في {date}.",
    saved: "تم حفظ اسم المستخدم.",
    taken: "استخدم شخص آخر هذا الاسم للتو. اختر اسمًا آخر.",
    chooseAvailable: "اختر اسم مستخدم متاحًا أولًا.",
  },
} satisfies Messages;

export function AccountSection() {
  const t = useT(STRINGS);
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const current = user?.username ?? null;
  const [username, setUsername] = useState(current ?? "");
  const [status, setStatus] = useState<UsernameStatus>("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextAt, setNextAt] = useState<string | null>(null);
  // When this card was opened: the 30-day lock is judged against it.
  const [openedAt] = useState(() => Date.now());

  if (!user) return null;

  const changedAt = user.usernameChangedAt ? new Date(user.usernameChangedAt) : null;
  const lockedUntil =
    nextAt ??
    (changedAt && current
      ? new Date(changedAt.getTime() + CHANGE_INTERVAL_DAYS * 86_400_000).toISOString()
      : null);
  const locked = Boolean(lockedUntil && new Date(lockedUntil).getTime() > openedAt);
  const dirty = normalizeUsername(username) !== (current ?? "");

  async function save() {
    if (!usernameSubmittable(status)) {
      setError(t.chooseAvailable);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.changeUsername(normalizeUsername(username));
      await refreshUser();
      toast.success(t.saved);
    } catch (err) {
      if (isApiErrorCode(err, "USERNAME_CHANGE_TOO_SOON")) {
        setNextAt(apiErrorDetails<{ nextChangeAt: string }>(err)?.nextChangeAt ?? null);
      } else {
        setError(isApiErrorCode(err, "USERNAME_TAKEN") ? t.taken : errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
      <ProfileEditor />

      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        {/* The sign-in email, and changing it (EmailChange.tsx). */}
        <EmailChange label={t.email} />
        <PhoneVerification />
        <div className="sm:col-span-2">
          <dt className="text-ink-soft">{t.id}</dt>
          <dd className="mt-0.5 flex flex-wrap items-center gap-2">
            <code dir="ltr" className="break-all rounded bg-paper px-2 py-1 font-mono text-xs text-ink">
              {user.id}
            </code>
            <CopyButton value={user.id} label={t.copyId} />
          </dd>
          <p className="mt-1 text-xs text-ink-soft">{t.idHint}</p>
        </div>
      </dl>

      <div className="mt-5 max-w-md space-y-3">
        <UsernameField value={username} onChange={setUsername} onStatus={setStatus} current={current} disabled={locked || saving} />
        <p className="text-xs text-ink-soft">
          {locked && lockedUntil ? fmt(t.nextChange, { date: formatDate(lockedUntil) }) : t.rule}
        </p>
        {error && <Alert variant="danger">{error}</Alert>}
        {!locked && (
          <Button className="min-h-11" disabled={saving || !dirty} onClick={() => void save()}>
            {saving ? t.saving : t.save}
          </Button>
        )}
      </div>
    </section>
  );
}
