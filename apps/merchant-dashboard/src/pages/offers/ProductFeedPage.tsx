import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, CircleAlert, Copy } from "lucide-react";
import { Alert, Button, Card, Input } from "@store-builder/ui";
import {
  FEED_CHANNELS,
  feedsChecklist,
  feedsGet,
  feedsSave,
  type FeedCheckKey,
  type FeedChecklist,
  type FeedSettings,
  type FeedState,
} from "@store-builder/api-client";
import { apiBaseUrl, apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";

/**
 * The product feed (SPEC §7.8): one fixed link per ad channel that always
 * holds the store's current catalog, and the Google Merchant checklist —
 * what approval needs from the store's contact details and policies.
 */

const STRINGS = {
  en: {
    back: "Offers",
    title: "Product feed",
    description: "A link for each ad platform's catalog. It updates by itself when you change products or prices.",
    enabled: "Publish the product feed",
    count: "{items} items from {products} products are in the feed.",
    countEmpty: "No products are in the feed yet. A product needs to be active, visible and have an image.",
    brand: "Brand",
    brandHint: "Leave blank to use your store's name.",
    category: "Google product category",
    categoryHint: "Optional, e.g. “Apparel & Accessories > Clothing”.",
    excludeOut: "Leave out sold-out items",
    save: "Save",
    saving: "Saving…",
    saved: "Feed settings saved.",
    links: "Feed links",
    linksHint: "Paste the link into the platform's catalog as a scheduled feed. Use XML unless the platform asks for CSV.",
    linksOff: "Switch the feed on and save to get working links.",
    channel_meta: "Meta (Facebook and Instagram)",
    channel_google: "Google Merchant Center",
    channel_tiktok: "TikTok",
    channel_snapchat: "Snapchat",
    copyXml: "Copy XML link",
    copyCsv: "CSV",
    copied: "Link copied.",
    checklist: "Google Merchant checklist",
    checklistReady: "Your store has what Google Merchant asks for.",
    checklistMissing: "Finish these before you submit the feed to Google Merchant:",
    check_store_info_enabled: "Store information is shown in the store",
    check_email: "A contact email",
    check_phone: "A contact phone number",
    check_address: "The business address",
    check_shipping_policy: "A shipping policy",
    check_return_policy: "A return policy",
    check_cod_policy: "A cash-on-delivery policy",
    check_privacy_policy: "A privacy policy",
    check_products: "At least one product in the feed",
    check_feed_enabled: "The feed is published",
    fix_store_info: "Store information",
    fix_legal: "Policies",
    fix_catalog: "Products",
  },
  ar: {
    back: "العروض",
    title: "ملف المنتجات",
    description: "رابط لكتالوج كل منصة إعلانات. يتحدّث تلقائيًا عند تغيير المنتجات أو الأسعار.",
    enabled: "نشر ملف المنتجات",
    count: "{items} عنصر من {products} منتج في الملف.",
    countEmpty: "مفيش منتجات في الملف لسه. يجب أن يكون المنتج نشطًا وظاهرًا وله صورة.",
    brand: "العلامة التجارية",
    brandHint: "اتركه فارغًا لاستخدام اسم متجرك.",
    category: "تصنيف منتجات Google",
    categoryHint: "اختياري، مثل «Apparel & Accessories > Clothing».",
    excludeOut: "استبعاد العناصر التي نفدت",
    save: "حفظ",
    saving: "بنحفظ…",
    saved: "تم حفظ إعدادات الملف.",
    links: "روابط الملف",
    linksHint: "الصق الرابط في كتالوج المنصة كملف مجدول. استخدم XML إلا إذا طلبت المنصة CSV.",
    linksOff: "فعّل الملف واحفظ لتعمل الروابط.",
    channel_meta: "Meta (فيسبوك وإنستجرام)",
    channel_google: "Google Merchant Center",
    channel_tiktok: "TikTok",
    channel_snapchat: "Snapchat",
    copyXml: "نسخ رابط XML",
    copyCsv: "CSV",
    copied: "اتنسخ اللينك.",
    checklist: "قائمة فحص Google Merchant",
    checklistReady: "متجرك فيه ما يطلبه Google Merchant.",
    checklistMissing: "أكمل هذه قبل إرسال الملف إلى Google Merchant:",
    check_store_info_enabled: "معلومات المتجر ظاهرة في المتجر",
    check_email: "إيميل للتواصل",
    check_phone: "رقم هاتف للتواصل",
    check_address: "عنوان النشاط",
    check_shipping_policy: "سياسة الشحن",
    check_return_policy: "سياسة الاسترجاع",
    check_cod_policy: "سياسة الدفع عند الاستلام",
    check_privacy_policy: "سياسة الخصوصية",
    check_products: "منتج واحد على الأقل في الملف",
    check_feed_enabled: "الملف منشور",
    fix_store_info: "معلومات المتجر",
    fix_legal: "السياسات",
    fix_catalog: "المنتجات",
  },
} satisfies Messages;

/** Where each kind of gap is fixed. Store info and policies are on the store settings screen. */
const FIX_ROUTE: Record<string, string | null> = { store_info: "/store-settings", legal: "/store-settings", catalog: "/catalog", feed: null };

/** The API base as an absolute URL: the dashboard may be configured with a relative one. */
function absoluteApiBase(): string {
  return /^https?:\/\//i.test(apiBaseUrl) ? apiBaseUrl : `${window.location.origin}${apiBaseUrl}`;
}

export function ProductFeedPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [state, setState] = useState<FeedState | null>(null);
  const [draft, setDraft] = useState<FeedSettings | null>(null);
  const [checklist, setChecklist] = useState<FeedChecklist | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = useAsync(async () => {
    const [feed, checks] = await Promise.all([feedsGet(apiClient, workspaceId), feedsChecklist(apiClient, workspaceId)]);
    setState(feed);
    setDraft(feed.feed);
    setChecklist(checks);
    return feed;
  }, [workspaceId]);

  const set = <K extends keyof FeedSettings>(key: K, value: FeedSettings[K]) => setDraft((current) => (current ? { ...current, [key]: value } : current));

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await feedsSave(apiClient, workspaceId, draft);
      setState(saved);
      setDraft(saved.feed);
      setChecklist(await feedsChecklist(apiClient, workspaceId));
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copy(path: string) {
    try {
      await navigator.clipboard.writeText(`${absoluteApiBase()}${path}`);
      toast.success(t.copied);
    } catch {
      /* the link is on screen to select */
    }
  }

  const missing = (checklist?.checks ?? []).filter((check) => !check.ok);

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title={t.title} description={t.description} back={{ to: "/offers", label: t.back }} />
      <DataState loading={data.loading} error={data.error} onRetry={() => data.refresh()}>
        {draft && state && (
          <>
            <Card className="space-y-4 p-5">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
                <input type="checkbox" className="size-4 accent-primary" checked={draft.enabled} disabled={busy} onChange={(e) => set("enabled", e.target.checked)} />
                {t.enabled}
              </label>
              <p className="text-sm text-ink-soft">
                {state.itemCount > 0 ? fmt(t.count, { items: state.itemCount, products: state.productCount }) : t.countEmpty}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label={t.brand} hint={t.brandHint} maxLength={100} value={draft.brand} disabled={busy} onChange={(e) => set("brand", e.target.value)} />
                <TextField
                  label={t.category}
                  hint={t.categoryHint}
                  dir="ltr"
                  maxLength={250}
                  value={draft.googleProductCategory}
                  disabled={busy}
                  onChange={(e) => set("googleProductCategory", e.target.value)}
                />
              </div>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={draft.excludeOutOfStock}
                  disabled={busy}
                  onChange={(e) => set("excludeOutOfStock", e.target.checked)}
                />
                {t.excludeOut}
              </label>
              {error && <Alert variant="danger">{error}</Alert>}
              <div className="flex justify-end">
                <Button type="button" disabled={busy} onClick={() => void save()}>
                  {busy ? t.saving : t.save}
                </Button>
              </div>
            </Card>

            <Card className="space-y-3 p-5">
              <div>
                <h2 className="font-medium text-ink">{t.links}</h2>
                <p className="mt-0.5 text-sm text-ink-soft">{state.feed.enabled ? t.linksHint : t.linksOff}</p>
              </div>
              <ul className="space-y-3">
                {FEED_CHANNELS.map((channel) => (
                  <li key={channel} className="space-y-1.5">
                    <p className="text-sm font-medium text-ink">{t[`channel_${channel}`]}</p>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        aria-label={t[`channel_${channel}`]}
                        dir="ltr"
                        readOnly
                        value={`${absoluteApiBase()}${state.links[channel].xml}`}
                        onFocus={(e) => e.target.select()}
                        className="min-w-0 flex-1"
                      />
                      <Button type="button" variant="outline" className="shrink-0" disabled={!state.feed.enabled} onClick={() => void copy(state.links[channel].xml)}>
                        <Copy className="size-4" aria-hidden />
                        {t.copyXml}
                      </Button>
                      <Button type="button" variant="ghost" className="shrink-0" disabled={!state.feed.enabled} onClick={() => void copy(state.links[channel].csv)}>
                        {t.copyCsv}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            {checklist && (
              <Card className="space-y-3 p-5">
                <h2 className="font-medium text-ink">{t.checklist}</h2>
                <Alert variant={checklist.ready ? "success" : "info"}>{checklist.ready ? t.checklistReady : t.checklistMissing}</Alert>
                <ul className="divide-y divide-line">
                  {(checklist.ready ? checklist.checks : [...missing, ...checklist.checks.filter((c) => c.ok)]).map((check) => {
                    const route = FIX_ROUTE[check.fixAt];
                    return (
                      <li key={check.key} className="flex items-center gap-3 py-2.5 text-sm">
                        {check.ok ? (
                          <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
                        ) : (
                          <CircleAlert className="size-5 shrink-0 text-accent-dark" aria-hidden />
                        )}
                        <span className={check.ok ? "text-ink-soft" : "font-medium text-ink"}>{t[`check_${check.key as FeedCheckKey}`]}</span>
                        {!check.ok && route && (
                          <Link to={route} className="ms-auto shrink-0 text-sm font-medium text-primary hover:underline">
                            {t[`fix_${check.fixAt}` as "fix_store_info" | "fix_legal" | "fix_catalog"]}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
          </>
        )}
      </DataState>
    </div>
  );
}
