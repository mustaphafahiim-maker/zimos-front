import { useEffect, useState } from "react";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { IconInfo } from "@/components/icons";
import {
  shopperAccountsGet,
  shopperAccountsSave,
  type ShopperAccountsSettings,
  type ShopperChannel,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { STACK, SettingsSkeleton } from "./sections/parts";

const STRINGS = {
  en: {
    title: "Customer accounts",
    description:
      "Customers sign in to your store with a code we send them — no password — to see their orders, keep their addresses and order again in one tap.",
    enabled: "Let customers sign in to see their orders",
    enabledHint: "Off: the store shows no “Sign in” link and nobody can sign in.",
    channels: "How customers sign in",
    sms: "Phone (SMS code)",
    smsHint: "A first sign-in by phone makes the customer a contact, as an order would.",
    email: "Email code",
    emailHint: "Only customers whose email you already have can sign in with it.",
    atLeastOne: "Keep at least one way to sign in.",
    smsNote: "SMS codes are sent through your SMS provider.",
    save: "Save",
    saving: "Saving…",
    saved: "Customer accounts saved.",
    unsaved: "You have unsaved changes.",
  },
  ar: {
    title: "حسابات العملاء",
    description:
      "العميل يدخل متجرك بكود بنبعتهوله — من غير باسورد — ويشوف طلباته ويحفظ عناوينه ويطلب تاني بضغطة.",
    enabled: "خلّي العملاء يدخلوا يشوفوا طلباتهم",
    enabledHint: "لو مقفول: المتجر مش هيظهر فيه «تسجيل الدخول» ومحدش هيقدر يدخل.",
    channels: "العميل يدخل بإيه",
    sms: "الموبايل (كود في رسالة SMS)",
    smsHint: "أول دخول بالموبايل بيضيف العميل لجهات الاتصال، زي الأوردر بالظبط.",
    email: "كود على الإيميل",
    emailHint: "يدخل بيه بس العملاء اللي إيميلهم متسجل عندك.",
    atLeastOne: "لازم تسيب طريقة دخول واحدة على الأقل.",
    smsNote: "أكواد الدخول بتتبعت في رسالة SMS من خلال مزوّد الرسايل بتاعك.",
    save: "حفظ",
    saving: "بيحفظ…",
    saved: "اتحفظت إعدادات حسابات العملاء.",
    unsaved: "عندك تغييرات لسه ما اتحفظتش.",
  },
} satisfies Messages;

const CHANNELS: readonly ShopperChannel[] = ["sms", "email"];
const DEFAULTS: ShopperAccountsSettings = { enabled: false, channels: ["sms"] };

const same = (a: ShopperAccountsSettings, b: ShopperAccountsSettings) =>
  a.enabled === b.enabled && a.channels.length === b.channels.length && a.channels.every((c) => b.channels.includes(c));

/**
 * Store settings → Customer accounts (frontend-handoff 185): whether shoppers
 * can sign in with a code to see their orders, keep addresses and order
 * again, and by which channels (SMS, email — at least one). Needs
 * website.edit to read and save; without it the GET answers 403 and
 * DataState draws the no-permission card.
 */
export function CustomerAccountsTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const loaded = useAsync(() => shopperAccountsGet(apiClient, workspaceId), [workspaceId]);
  const [draft, setDraft] = useState<ShopperAccountsSettings>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loaded.data) setDraft(loaded.data);
  }, [loaded.data]);

  const dirty = loaded.data ? !same(draft, loaded.data) : false;
  useReportDirty(dirty);

  function toggleChannel(channel: ShopperChannel, on: boolean) {
    setDraft((prev) => {
      const next = on ? [...prev.channels, channel] : prev.channels.filter((c) => c !== channel);
      // The API needs at least one; the last one stays on.
      return next.length ? { ...prev, channels: CHANNELS.filter((c) => next.includes(c)) } : prev;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const saved = await shopperAccountsSave(apiClient, workspaceId, draft);
      loaded.setData(saved);
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DataState loading={loaded.loading && !loaded.data} error={loaded.error} onRetry={() => void loaded.refresh()} skeleton={<SettingsSkeleton />}>
      {/* Its own column: the save bar stays with this form, apart from the Google part under it. */}
      <div className={STACK}>
        <SettingsGroup description={t.description}>
          <SettingsSwitch
            label={t.enabled}
            hint={t.enabledHint}
            checked={draft.enabled}
            disabled={busy}
            onChange={(enabled) => setDraft((prev) => ({ ...prev, enabled }))}
          />
        </SettingsGroup>

        <SettingsGroup
          title={t.channels}
          footer={
            <>
              <span className="block">{t.atLeastOne}</span>
              {draft.channels.includes("sms") && (
                <span className="mt-1 flex items-start gap-1.5">
                  <IconInfo className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {t.smsNote}
                </span>
              )}
            </>
          }
        >
          {CHANNELS.map((channel) => (
            <SettingsSwitch
              key={channel}
              label={channel === "sms" ? t.sms : t.email}
              hint={channel === "sms" ? t.smsHint : t.emailHint}
              checked={draft.channels.includes(channel)}
              disabled={busy}
              // The only one that is on stays on (toggleChannel refuses): the API needs one way to sign in.
              onChange={(on) => toggleChannel(channel, on)}
            />
          ))}
        </SettingsGroup>

        <SaveBar
          dirty={dirty}
          saving={busy}
          onSave={() => void save()}
          onDiscard={() => {
            if (loaded.data) setDraft(loaded.data);
            setError(null);
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
      </div>
    </DataState>
  );
}
