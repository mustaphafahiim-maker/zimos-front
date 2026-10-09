import { useId, useState, type FormEvent } from "react";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { IconInfo, IconPlace, IconPlaceOff, IconSearch, IconWarning } from "@/components/icons";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import {
  addressLookupSettings,
  addressLookupUpdate,
  apiErrorCode,
  type AddressLookupSettings,
  type AddressLookupUpdate,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Section } from "@/components/Section";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Address suggestions at checkout",
    description:
      "While the customer types their address, the checkout suggests places. A pick fills the region, city and area, so the right shipping price shows straight away.",
    source: "Suggestions from",
    off: "Off",
    offHint: "The customer fills the address by hand.",
    builtin: "Your places list",
    builtinHint: "Your regions, cities and areas on this page. No key, no cost.",
    google: "Google Maps",
    googleHint: "Streets and landmarks too, matched to your places list. Needs your own Google API key.",
    apiKey: "Google API key",
    keyHint: "A key with the Places API (New) turned on, from your Google Cloud console.",
    keySaved: "A key is saved — leave this empty to keep it.",
    keyShort: "That key looks too short. Copy it again from your Google Cloud console.",
    billing: "Google bills your Google Cloud account for these lookups.",
    lastError:
      "Google refused the saved key, so customers get suggestions from your places list for now. Check the key in your Google Cloud console and save it again.",
    save: "Save",
    saving: "Saving…",
    saved: "Address suggestions saved.",
  },
  ar: {
    title: "اقتراحات العنوان في صفحة الدفع",
    description:
      "العميل وهو بيكتب عنوانه، صفحة الدفع بتقترح عليه أماكن. ولما يختار واحد، المحافظة والمدينة والمنطقة بيتملوا لوحدهم، وسعر الشحن الصح بيظهر على طول.",
    source: "الاقتراحات منين",
    off: "مقفولة",
    offHint: "العميل بيكتب العنوان بإيده.",
    builtin: "قائمة أماكنك",
    builtinHint: "المحافظات والمدن والمناطق بتاعتك اللي في الصفحة دي. من غير مفتاح ومن غير تكلفة.",
    google: "خرائط جوجل",
    googleHint: "كمان الشوارع والأماكن المعروفة، وبنطابقها مع قائمة أماكنك. محتاجة مفتاح Google API بتاعك.",
    apiKey: "مفتاح Google API",
    keyHint: "مفتاح مفعّل عليه Places API (New)، من Google Cloud console بتاعك.",
    keySaved: "فيه مفتاح متسجل — سيب الخانة فاضية عشان يفضل هو.",
    keyShort: "المفتاح ده شكله ناقص. انسخه تاني من Google Cloud console.",
    billing: "جوجل بتحاسب حساب Google Cloud بتاعك على عمليات البحث دي.",
    lastError:
      "جوجل رفضت المفتاح المتسجل، فالعملاء بتطلعلهم اقتراحات من قائمة أماكنك لحد ما تصلّحه. راجع المفتاح في Google Cloud console واحفظه تاني.",
    save: "حفظ",
    saving: "بيحفظ…",
    saved: "اقتراحات العنوان اتحفظت.",
  },
} satisfies Messages;

type Choice = AddressLookupSettings["provider"];

/**
 * Shipping → Places → "Address suggestions at checkout" (frontend-handoff
 * 184): off, the store's own places list (the default) or Google Maps with
 * the store's own key. The key is never sent back — `hasKey` says one is
 * saved, and an empty field keeps it. When Google later refuses the key the
 * API keeps `lastError` and shoppers get the places list meanwhile.
 */
export function AddressLookupSection() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const settings = useAsync<AddressLookupSettings>(() => addressLookupSettings(apiClient, workspaceId), [workspaceId]);

  return (
    <Section title={t.title} description={t.description}>
      <DataState loading={settings.loading && !settings.data} error={settings.error} onRetry={() => settings.refresh()}>
        {settings.data && <AddressLookupForm data={settings.data} onSaved={settings.setData} />}
      </DataState>
    </Section>
  );
}

function AddressLookupForm({ data, onSaved }: { data: AddressLookupSettings; onSaved: (next: AddressLookupSettings) => void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const name = useId();
  const keyId = useId();

  const [provider, setProvider] = useState<Choice>(data.provider);
  const [apiKey, setApiKey] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const key = apiKey.trim();
  const dirty = provider !== data.provider || (provider === "google" && key !== "");
  useReportDirty(dirty);

  const known: Record<string, { label: string; hint: string; icon: typeof IconPlace }> = {
    builtin: { label: t.builtin, hint: t.builtinHint, icon: IconPlace },
    google: { label: t.google, hint: t.googleHint, icon: IconSearch },
  };
  const choices: Array<{ code: Choice; label: string; hint: string; icon: typeof IconPlace }> = [
    { code: "off", label: t.off, hint: t.offHint, icon: IconPlaceOff },
    ...data.providers.map((p) => ({
      code: p.code,
      label: known[p.code]?.label ?? (locale === "ar" ? p.name.ar : p.name.en),
      hint: known[p.code]?.hint ?? "",
      icon: known[p.code]?.icon ?? IconPlace,
    })),
  ];

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!dirty || saving) return;
    setError(null);
    setKeyError(null);
    if (provider === "google" && key && key.length < 20) {
      setKeyError(t.keyShort);
      return;
    }
    const body: AddressLookupUpdate = { provider, ...(provider === "google" && key ? { apiKey: key } : {}) };
    setSaving(true);
    try {
      const next = await addressLookupUpdate(apiClient, workspaceId, body);
      setApiKey("");
      onSaved(next);
      toast.success(t.saved);
    } catch (err) {
      const code = apiErrorCode(err);
      // The key's own problems are said under the key.
      if (code === "ADDRESS_LOOKUP_KEY_REQUIRED" || code === "ADDRESS_LOOKUP_INVALID_KEY") setKeyError(errorMessage(err));
      else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {data.lastError && data.provider === "google" && (
        <div role="status" className="flex items-start gap-2.5 rounded-[var(--radius)] border border-accent/40 bg-accent-soft px-3.5 py-3 text-sm text-accent-dark">
          <IconWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{t.lastError}</p>
        </div>
      )}

      <fieldset className="space-y-2" disabled={saving}>
        <legend className="mb-1.5 text-sm font-medium text-ink">{t.source}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {choices.map((choice) => {
            const checked = provider === choice.code;
            const Icon = choice.icon;
            return (
              <label
                key={choice.code}
                className={cn(
                  "flex min-h-11 cursor-pointer items-start gap-2.5 rounded-[var(--radius)] border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary",
                  checked ? "border-primary bg-primary-soft/60" : "border-line hover:border-line-strong"
                )}
              >
                <input
                  type="radio"
                  name={name}
                  className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
                  checked={checked}
                  // The name is the choice; its hint is read as the description.
                  aria-labelledby={`${name}-${choice.code}`}
                  aria-describedby={choice.hint ? `${name}-${choice.code}-hint` : undefined}
                  onChange={() => {
                    setProvider(choice.code);
                    setKeyError(null);
                  }}
                />
                <span className="min-w-0">
                  <span id={`${name}-${choice.code}`} className={cn("flex items-center gap-1.5 text-sm font-medium", checked ? "text-primary-dark" : "text-ink")}>
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {choice.label}
                  </span>
                  {choice.hint && (
                    <span id={`${name}-${choice.code}-hint`} className="mt-0.5 block text-xs text-ink-soft">
                      {choice.hint}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {provider === "google" && (
        <div className="space-y-3">
          <div className="max-w-md space-y-1.5">
            <label htmlFor={keyId} className="block text-sm font-medium text-ink">
              {t.apiKey}
              {!data.hasKey && <span className="text-danger"> *</span>}
            </label>
            <Input
              id={keyId}
              type="password"
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              maxLength={200}
              value={apiKey}
              placeholder={data.hasKey ? "••••••••••••" : "AIza…"}
              onChange={(e) => {
                setApiKey(e.target.value);
                setKeyError(null);
              }}
              aria-invalid={keyError ? true : undefined}
              aria-describedby={`${keyId}-note`}
              className={cn("min-h-11 text-start", keyError && "border-danger focus-visible:ring-danger/30")}
              disabled={saving}
            />
            <p id={`${keyId}-note`} className={cn("text-xs", keyError ? "font-medium text-danger" : "text-ink-soft")}>
              {keyError ?? (data.hasKey ? t.keySaved : t.keyHint)}
            </p>
          </div>
          <p className="flex items-start gap-2 text-xs text-ink-soft">
            <IconInfo className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
            {t.billing}
          </p>
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="flex justify-end">
        <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={!dirty || saving}>
          {saving ? t.saving : t.save}
        </Button>
      </div>
    </form>
  );
}
