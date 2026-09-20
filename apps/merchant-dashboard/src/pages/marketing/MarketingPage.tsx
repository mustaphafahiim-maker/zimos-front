import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link2, Radio } from "lucide-react";
import { Alert, Button } from "@store-builder/ui";
import type { TrackingPixels } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { TextField } from "@/components/Field";
import { CopyButton } from "@/components/CopyButton";
import { useToast } from "@/components/Toast";

/**
 * The ad networks the storefront can load a pixel for. Each `pattern` is the
 * same one the backend validates with, so a bad ID is caught before the
 * request rather than coming back as a 422 with no field attached.
 */
const PLATFORMS = [
  {
    key: "meta",
    name: "Meta (Facebook & Instagram)",
    pattern: /^\d{5,20}$/,
    example: "123456789012345",
  },
  { key: "tiktok", name: "TikTok", pattern: /^[A-Z0-9]{10,30}$/, example: "C4ABCDEF1234567890" },
  {
    key: "snapchat",
    name: "Snapchat",
    pattern: /^[a-f0-9-]{20,40}$/i,
    example: "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
  },
  {
    key: "google_tag",
    name: "Google (GA4 / Ads)",
    pattern: /^(G|AW|GT)-[A-Z0-9]{4,20}$/,
    example: "G-ABC123XYZ",
  },
] as const satisfies ReadonlyArray<{
  key: keyof TrackingPixels;
  name: string;
  pattern: RegExp;
  example: string;
}>;

type PlatformKey = (typeof PLATFORMS)[number]["key"];

const EMPTY: Record<PlatformKey, string> = { meta: "", tiktok: "", snapchat: "", google_tag: "" };

const STRINGS = {
  en: {
    title: "Marketing pixels",
    description: "Connect your ad pixels and build tracked links for your campaigns.",
    pixelsTitle: "Ad pixels",
    pixelsDesc:
      "Paste the pixel ID from each ad platform. It loads on every page of your store, for every visitor.",
    eventsNote:
      "Your store sends the standard events on its own: page view, product view, add to cart, checkout started, and purchase with the real order total.",
    serverSide:
      "Browser pixels only for now — server-side conversions (Conversions API) aren't wired up yet.",
    idHint: "Example: {example}",
    invalid: "That doesn't look like a valid ID for this platform.",
    connected: "Connected",
    notConnected: "Not connected",
    save: "Save pixels",
    saving: "Saving…",
    saved: "Pixels saved. They're live on your store now.",
    utmTitle: "Tracked link builder",
    utmDesc:
      "Add UTM tags to a store link so your ad platform can tell you which ad brought each visit. Nothing is saved — copy the link and use it in your ad.",
    path: "Store page",
    pathHint: "e.g. / or /products/your-product",
    source: "Source (utm_source)",
    medium: "Medium (utm_medium)",
    campaign: "Campaign (utm_campaign)",
    content: "Ad or creative (utm_content)",
    result: "Your link",
    copy: "Copy link",
  },
  ar: {
    title: "بيكسلات الإعلانات",
    description: "اربط بيكسلات الإعلانات واعمل لينكات متتبعة لحملاتك.",
    pixelsTitle: "بيكسلات الإعلانات",
    pixelsDesc: "حط رقم البيكسل من كل منصة إعلانات. هيشتغل في كل صفحات متجرك ومع كل زائر.",
    eventsNote:
      "متجرك بيبعت الأحداث المعروفة لوحده: فتح صفحة، مشاهدة منتج، إضافة للسلة، بدء الطلب، والشراء بقيمة الطلب الحقيقية.",
    serverSide: "دلوقتي بيكسل المتصفح بس — التتبع من السيرفر (Conversions API) لسه متظبطش.",
    idHint: "مثال: {example}",
    invalid: "الرقم ده مش شكله صح للمنصة دي.",
    connected: "متوصل",
    notConnected: "مش متوصل",
    save: "احفظ البيكسلات",
    saving: "بنحفظ…",
    saved: "اتحفظت، والبيكسلات شغالة في متجرك دلوقتي.",
    utmTitle: "عمل لينك متتبع",
    utmDesc:
      "ضيف علامات UTM على لينك متجرك عشان منصة الإعلانات تقولك أنهي إعلان جاب كل زيارة. مفيش حاجة بتتحفظ — انسخ اللينك واستخدمه في الإعلان.",
    path: "صفحة المتجر",
    pathHint: "مثلاً / أو /products/اسم-المنتج",
    source: "المصدر (utm_source)",
    medium: "الوسيلة (utm_medium)",
    campaign: "الحملة (utm_campaign)",
    content: "الإعلان أو التصميم (utm_content)",
    result: "اللينك بتاعك",
    copy: "انسخ اللينك",
  },
} satisfies Messages;

/** The stored blob, named. `WorkspaceSettings` types it as `unknown`. */
function storedPixels(settings: Record<string, unknown> | undefined): TrackingPixels {
  const value = settings?.tracking_pixels;
  return value && typeof value === "object" ? (value as TrackingPixels) : {};
}

export function MarketingPage() {
  const t = useT(STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace, refresh } = useWorkspace();

  const stored = storedPixels(currentWorkspace?.settings);
  const [ids, setIds] = useState<Record<PlatformKey, string>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Seed the fields from the workspace once it is loaded, and again after a
  // save refreshes it. Keyed on the serialised blob so an unrelated workspace
  // update does not wipe what the merchant is halfway through typing.
  const storedKey = JSON.stringify(stored);
  useEffect(() => {
    const saved = storedPixels(currentWorkspace?.settings);
    setIds({
      meta: saved.meta ?? "",
      tiktok: saved.tiktok ?? "",
      snapchat: saved.snapchat ?? "",
      google_tag: saved.google_tag ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace?.id, storedKey]);

  const invalidCount = PLATFORMS.filter(
    (p) => ids[p.key].trim() !== "" && !p.pattern.test(ids[p.key].trim())
  ).length;

  async function savePixels(e: FormEvent) {
    e.preventDefault();
    if (invalidCount > 0) return;
    setSaving(true);
    setFormError(null);
    try {
      // Every key is sent: a cleared field has to become `null` to switch the
      // pixel off, and omitting it would keep the stored ID instead.
      const tracking_pixels = Object.fromEntries(
        PLATFORMS.map((p) => [p.key, ids[p.key].trim() || null])
      ) as TrackingPixels;
      await apiClient.updateWorkspaceSettings(workspaceId, { tracking_pixels });
      await refresh();
      toast.success(t.saved);
    } catch (err) {
      // A 422 names the field, but the name is the network key, so the first
      // message is shown above the form rather than beside a guessed input.
      const fields = getFieldErrors(err);
      setFormError(Object.values(fields)[0] ?? getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // Pure client-side tool; nothing here is stored or sent anywhere.
  const [utm, setUtm] = useState({
    path: "/",
    source: "facebook",
    medium: "paid_social",
    campaign: "",
    content: "",
  });

  const link = useMemo(() => {
    const trimmed = utm.path.trim();
    const path = trimmed === "" || trimmed === "/" ? "" : trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    const query = new URLSearchParams();
    for (const [key, value] of [
      ["utm_source", utm.source],
      ["utm_medium", utm.medium],
      ["utm_campaign", utm.campaign],
      ["utm_content", utm.content],
    ] as const) {
      if (value.trim()) query.set(key, value.trim());
    }
    const base = `${STOREFRONT_URL}/store/${currentWorkspace?.slug || workspaceId}${path}`;
    const qs = query.toString();
    return qs ? `${base}?${qs}` : base;
  }, [utm, workspaceId, currentWorkspace?.slug]);

  return (
    <div className="min-w-0 max-w-4xl">
      <PageHeader title={t.title} description={t.description} />

      <section className="mb-8">
        <h2 className="flex items-center gap-2 font-display text-lg font-medium text-ink">
          <Radio className="size-4 text-primary" aria-hidden />
          {t.pixelsTitle}
        </h2>
        <p className="mb-3 text-sm text-ink-soft">{t.pixelsDesc}</p>
        <form
          onSubmit={savePixels}
          noValidate
          className="space-y-4 rounded-[var(--radius-card)] border border-line bg-paper-raised p-4"
        >
          {formError && <Alert variant="danger">{formError}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            {PLATFORMS.map((platform) => {
              const value = ids[platform.key];
              const bad = value.trim() !== "" && !platform.pattern.test(value.trim());
              const live = Boolean(stored[platform.key]);
              return (
                <div key={platform.key} className="rounded-[0.5rem] border border-line p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{platform.name}</span>
                    <span
                      className={
                        live
                          ? "rounded-full border border-success/30 bg-success-soft px-2 py-0.5 text-xs font-medium text-success"
                          : "rounded-full border border-line bg-paper px-2 py-0.5 text-xs font-medium text-ink-soft"
                      }
                    >
                      {live ? t.connected : t.notConnected}
                    </span>
                  </div>
                  <TextField
                    label={platform.name}
                    dir="ltr"
                    inputMode="text"
                    autoComplete="off"
                    value={value}
                    placeholder={platform.example}
                    onChange={(e) =>
                      setIds((prev) => ({ ...prev, [platform.key]: e.target.value }))
                    }
                    error={bad ? t.invalid : undefined}
                    hint={bad ? undefined : fmt(t.idHint, { example: platform.example })}
                  />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-ink-soft">{t.eventsNote}</p>
          <p className="text-xs text-ink-soft">{t.serverSide}</p>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || invalidCount > 0}>
              {saving ? t.saving : t.save}
            </Button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="flex items-center gap-2 font-display text-lg font-medium text-ink">
          <Link2 className="size-4 text-primary" aria-hidden />
          {t.utmTitle}
        </h2>
        <p className="mb-3 text-sm text-ink-soft">{t.utmDesc}</p>
        <div className="space-y-4 rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t.path}
              dir="ltr"
              value={utm.path}
              hint={t.pathHint}
              onChange={(e) => setUtm((prev) => ({ ...prev, path: e.target.value }))}
            />
            <TextField
              label={t.source}
              dir="ltr"
              value={utm.source}
              onChange={(e) => setUtm((prev) => ({ ...prev, source: e.target.value }))}
            />
            <TextField
              label={t.medium}
              dir="ltr"
              value={utm.medium}
              onChange={(e) => setUtm((prev) => ({ ...prev, medium: e.target.value }))}
            />
            <TextField
              label={t.campaign}
              dir="ltr"
              value={utm.campaign}
              onChange={(e) => setUtm((prev) => ({ ...prev, campaign: e.target.value }))}
            />
            <TextField
              label={t.content}
              dir="ltr"
              value={utm.content}
              onChange={(e) => setUtm((prev) => ({ ...prev, content: e.target.value }))}
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">{t.result}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <code
                dir="ltr"
                className="min-w-0 flex-1 break-all rounded-[0.5rem] border border-line bg-paper px-3 py-2 text-xs text-ink"
              >
                {link}
              </code>
              <CopyButton
                value={link}
                label={t.copy}
                className="border border-line bg-paper-raised px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
