import { useEffect, useId, useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import { Info } from "lucide-react";
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
import { Section } from "@/components/Section";
import { useToast } from "@/components/Toast";

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
  const hintId = useId();
  const channelsHintId = useId();
  const channelsTitleId = useId();

  useEffect(() => {
    if (loaded.data) setDraft(loaded.data);
  }, [loaded.data]);

  const dirty = loaded.data ? !same(draft, loaded.data) : false;

  function toggleChannel(channel: ShopperChannel, on: boolean) {
    setDraft((prev) => {
      const next = on ? [...prev.channels, channel] : prev.channels.filter((c) => c !== channel);
      // The API needs at least one; the last one stays ticked.
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
    <Section title={t.title} description={t.description}>
      <DataState loading={loaded.loading && !loaded.data} error={loaded.error} onRetry={() => void loaded.refresh()}>
        <div className="space-y-5">
          <div className="space-y-1">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
              <input
                type="checkbox"
                role="switch"
                className="size-5 shrink-0 cursor-pointer accent-primary"
                checked={draft.enabled}
                aria-describedby={hintId}
                onChange={(e) => setDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              {t.enabled}
            </label>
            <p id={hintId} className="text-xs text-ink-soft">
              {t.enabledHint}
            </p>
          </div>

          <div role="group" aria-labelledby={channelsTitleId} aria-describedby={channelsHintId} className="space-y-1 rounded-[var(--radius)] bg-paper-sunken p-3">
            <p id={channelsTitleId} className="text-sm font-semibold text-ink">
              {t.channels}
            </p>
            {CHANNELS.map((channel) => {
              const checked = draft.channels.includes(channel);
              const last = checked && draft.channels.length === 1;
              return (
                <div key={channel}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 py-1 text-sm text-ink">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-default"
                      checked={checked}
                      // The only ticked one stays: the API needs one way to sign in.
                      aria-disabled={last || undefined}
                      onChange={(e) => toggleChannel(channel, e.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{channel === "sms" ? t.sms : t.email}</span>
                      <span className="block text-xs text-ink-soft">{channel === "sms" ? t.smsHint : t.emailHint}</span>
                    </span>
                  </label>
                </div>
              );
            })}
            <p id={channelsHintId} className="text-xs text-ink-soft">
              {t.atLeastOne}
            </p>
          </div>

          {draft.channels.includes("sms") && (
            <p className="flex items-start gap-2 rounded-[var(--radius)] bg-primary-soft px-3 py-2.5 text-sm text-primary-dark">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t.smsNote}
            </p>
          )}

          {error && <Alert variant="danger">{error}</Alert>}
          <div className="flex flex-wrap items-center justify-end gap-3">
            {dirty && <p className="text-xs text-ink-soft">{t.unsaved}</p>}
            <Button type="button" className="min-h-11" disabled={busy || !dirty} onClick={() => void save()}>
              {busy ? t.saving : t.save}
            </Button>
          </div>
        </div>
      </DataState>
    </Section>
  );
}
