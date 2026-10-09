import { useId, useState } from "react";
import { Alert, Input } from "@store-builder/ui";
import { accountErrorCode, accountNameSave, apiErrorDetails, isApiErrorCode } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { normalizeUsername, usernameSubmittable, type UsernameStatus } from "@/lib/username";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { CopyButton } from "@/components/CopyButton";
import { UsernameField } from "@/components/UsernameField";
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup, SettingsRow } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { SettingsCard } from "./sections/SettingsCard";
import { PhoneVerification } from "./PhoneVerification";
import { ProfileEditor } from "./ProfileEditor";
import { EmailChangeByCode } from "./EmailChangeByCode";

/** How often a username may be changed (the backend's CHANGE_INTERVAL_DAYS). */
const CHANGE_INTERVAL_DAYS = 30;

const STRINGS = {
  en: {
    title: "Your account",
    description: "Your sign-in details. These belong to you, not to the store.",
    name: "Your name",
    nameSaved: "Name saved",
    nameInvalid: "The name must be 2 to 200 characters",
    email: "Email",
    id: "Account ID",
    idHint: "Support may ask for it to find your account.",
    copyId: "Copy ID",
    save: "Save",
    saving: "Saving…",
    rule: "You can change your username once every 30 days.",
    nextChange: "You changed your username recently. You can change it again on {date}.",
    saved: "Username saved.",
    taken: "Someone just took this username. Choose another one.",
    chooseAvailable: "Choose an available username first.",
  },
  ar: {
    title: "حسابك",
    description: "دي بيانات دخولك إنت، مش بتاعة المتجر.",
    name: "اسمك",
    nameSaved: "اتحفظ الاسم",
    nameInvalid: "الاسم لازم يكون من 2 لـ 200 حرف",
    email: "الإيميل",
    id: "رقم الحساب",
    idHint: "ممكن الدعم يطلبه منك عشان يلاقي حسابك.",
    copyId: "انسخ الرقم",
    save: "حفظ",
    saving: "بنحفظ…",
    rule: "تقدر تغيّر اسم المستخدم مرة كل 30 يوم.",
    nextChange: "غيّرت اسم المستخدم قريب. تقدر تغيّره تاني يوم {date}.",
    saved: "اسم المستخدم اتحفظ.",
    taken: "حد تاني لسه واخد الاسم ده. اختار اسم تاني.",
    chooseAvailable: "اختار اسم مستخدم متاح الأول.",
  },
} satisfies Messages;

export function AccountSection() {
  const t = useT(STRINGS);
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const nameId = useId();
  const current = user?.username ?? null;
  const [name, setName] = useState(user?.fullName ?? "");
  const [username, setUsername] = useState(current ?? "");
  const [status, setStatus] = useState<UsernameStatus>("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 422 INVALID_NAME, said under the name (handoff 332).
  const [nameError, setNameError] = useState<string | null>(null);
  const [nextAt, setNextAt] = useState<string | null>(null);
  // When this section was opened: the 30-day lock is judged against it.
  const [openedAt] = useState(() => Date.now());

  const changedAt = user?.usernameChangedAt ? new Date(user.usernameChangedAt) : null;
  const lockedUntil =
    nextAt ??
    (changedAt && current
      ? new Date(changedAt.getTime() + CHANGE_INTERVAL_DAYS * 86_400_000).toISOString()
      : null);
  const locked = Boolean(lockedUntil && new Date(lockedUntil).getTime() > openedAt);
  const nameDirty = Boolean(user) && name.trim() !== (user?.fullName ?? "");
  const usernameDirty = Boolean(user) && !locked && normalizeUsername(username) !== (current ?? "");
  const dirty = nameDirty || usernameDirty;
  useReportDirty(dirty);

  if (!user) return null;

  function discard() {
    setName(user?.fullName ?? "");
    setUsername(current ?? "");
    setError(null);
    setNameError(null);
  }

  // One save bar for the two things typed here; each still goes to its own endpoint, as before.
  // Not a <form>: the email and phone sheets inside are forms of their own, and their submit would reach this one.
  async function save() {
    if (saving) return;
    if (nameDirty && !name.trim()) return;
    if (usernameDirty && !usernameSubmittable(status)) {
      setError(t.chooseAvailable);
      return;
    }
    setSaving(true);
    setError(null);
    setNameError(null);
    try {
      if (nameDirty) {
        // The name has its own endpoint; picture and language stay on /auth/me/profile.
        await accountNameSave(apiClient, name.trim());
        await refreshUser();
        toast.success(t.nameSaved);
      }
      if (usernameDirty) {
        await apiClient.changeUsername(normalizeUsername(username));
        await refreshUser();
        toast.success(t.saved);
      }
    } catch (err) {
      if (accountErrorCode(err) === "INVALID_NAME") {
        setNameError(t.nameInvalid);
      } else if (isApiErrorCode(err, "USERNAME_CHANGE_TOO_SOON")) {
        setNextAt(apiErrorDetails<{ nextChangeAt: string }>(err)?.nextChangeAt ?? null);
        setUsername(current ?? "");
      } else {
        setError(isApiErrorCode(err, "USERNAME_TAKEN") ? t.taken : errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-[var(--bento-gap)]">
      <ProfileEditor />

      <SettingsGroup footer={t.description}>
        <SettingsRow
          label={t.name}
          htmlFor={nameId}
          control={
            <Input
              id={nameId}
              required
              maxLength={200}
              autoComplete="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              aria-invalid={nameError ? true : undefined}
              className="h-11 w-full text-base sm:text-sm"
            />
          }
          error={nameError ?? undefined}
        />
        {/* The sign-in email, and changing it with codes (EmailChangeByCode.tsx, handoff 332). */}
        <EmailChangeByCode label={t.email} />
        <PhoneVerification />
      </SettingsGroup>

      <SettingsCard>
        <UsernameField value={username} onChange={setUsername} onStatus={setStatus} current={current} disabled={locked || saving} />
        <p className="mt-2 text-[13px] leading-5 text-ink-soft">
          {locked && lockedUntil ? fmt(t.nextChange, { date: formatDate(lockedUntil) }) : t.rule}
        </p>
      </SettingsCard>

      <SettingsGroup>
        <SettingsRow
          label={t.id}
          hint={t.idHint}
          control={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <code dir="ltr" className="rounded-lg bg-paper-sunken px-2 py-1 font-mono text-xs break-all text-ink">
                {user.id}
              </code>
              <CopyButton value={user.id} label={t.copyId} />
            </div>
          }
        />
      </SettingsGroup>

      {error && <Alert variant="danger">{error}</Alert>}

      <SaveBar
        dirty={dirty}
        saving={saving}
        disabled={nameDirty && !name.trim()}
        saveLabel={t.save}
        savingLabel={t.saving}
        onSave={() => void save()}
        onDiscard={discard}
      />
    </div>
  );
}
